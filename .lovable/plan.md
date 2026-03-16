

# Correção: IA ignora prompt e repete saudações (conversas em andamento)

## Causa raiz

O problema persiste porque ao retomar uma conversa em andamento, o sistema usa o prompt **cacheado** no `flow_state` da conversa (gravado na primeira interação), e **nunca mais relê** o prompt atualizado da tabela `chatbot_flows.config`.

Fluxo atual:
```text
1ª mensagem → lê chatbot_flows.config → salva aiNodeData no flow_state da conversa
2ª mensagem em diante → lê flow_state.aiNodeData (CACHEADO, prompt antigo!)
                         ↑ NUNCA atualiza com o prompt novo
```

Isso explica por que:
- Mesmo trocando de modelo (GPT → Gemini), o comportamento não muda
- Mesmo editando o prompt, a IA continua respondendo com o prompt antigo
- O link nunca aparece porque o prompt salvo no `flow_state` não contém o link

### Evidência no código

`execute-flow/index.ts`, linhas 1889-1911 (RESUME path):
```typescript
// Usa dados CACHEADOS do flow_state — nunca relê da tabela
const { systemPrompt, model, temperature, maxTokens, knowledgeBase } = flowState.aiNodeData;
// ... chama callAI com o prompt velho
```

## Alterações

### 1. `supabase/functions/execute-flow/index.ts` — RESUME path (linhas ~1889-1911)

Antes de chamar a IA, **relêr** a config mais recente de `chatbot_flows` e usar o prompt atualizado:

```typescript
// Ao invés de:
const { systemPrompt, model, ... } = flowState.aiNodeData;

// Fazer:
const { data: latestFlow } = await supabase
  .from("chatbot_flows").select("config").eq("id", flowState.flowId).single();
const latestCfg = latestFlow?.config;

// Usar o config mais recente, com fallback para o cacheado
const systemPrompt = latestCfg?.systemPrompt || flowState.aiNodeData.systemPrompt;
const model = latestCfg?.model || flowState.aiNodeData.model;
// ... etc
```

### 2. `supabase/functions/execute-flow/index.ts` — INITIAL trigger (linha ~2110)

Parar de salvar `knowledgeBase` separadamente no `aiNodeData` (já está mesclado no systemPrompt):

```typescript
aiNodeData: {
  systemPrompt: cfg.systemPrompt || "...",
  model: cfg.model || "...",
  // knowledgeBase: cfg.knowledgeBase || "",  ← REMOVER
},
```

### 3. `supabase/functions/execute-flow/index.ts` — INITIAL trigger (linha ~2143)

Parar de passar `knowledgeBase` separado para `callAI()`:

```typescript
// Antes:
callAI(cfg.systemPrompt, message, model, temp, maxTokens, cfg.knowledgeBase || "", ...)

// Depois:
callAI(cfg.systemPrompt, message, model, temp, maxTokens, "", ...)
```

## Resumo

| Arquivo | Mudança |
|---|---|
| `execute-flow/index.ts` (RESUME, ~1889) | Relêr config mais recente de `chatbot_flows` em vez de usar cache do `flow_state` |
| `execute-flow/index.ts` (INITIAL, ~2110) | Remover `knowledgeBase` do `aiNodeData` cacheado |
| `execute-flow/index.ts` (INITIAL, ~2143) | Passar string vazia para `knowledgeBase` no `callAI()` |

Após o deploy, qualquer alteração no prompt será aplicada imediatamente em todas as conversas ativas, sem necessidade de recriar o agente ou encerrar conversas.

