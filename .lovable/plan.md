

# Correção: Respostas truncadas do Gemini 2.5 Pro

## Causa raiz identificada

O **Gemini 2.5 Pro** usa "thinking" (raciocinio interno) que **consome tokens do budget de output**. O default de `maxTokens` no sistema e **500** (definido em `AgentConfigPanel.tsx` linha 214). Com 500 tokens de output, o modelo gasta ~450 pensando e sobram ~50 para a resposta, resultando em mensagens cortadas como "Como o" e "Você está super interess".

Isso tambem explica por que o agente nao usa as informacoes da base de conhecimento: ele simplesmente nao tem tokens suficientes para formular uma resposta completa.

## Alteracoes

### 1. `supabase/functions/execute-flow/index.ts` — `callGoogleAI`

Forcar um `maxOutputTokens` minimo de **8192** para modelos Gemini 2.5 (que usam thinking). Isso garante que o modelo tenha budget suficiente para pensar E responder:

```typescript
// Na generationConfig:
maxOutputTokens: model.includes("2.5") ? Math.max(maxTokens || 4096, 8192) : (maxTokens || 4096),
```

### 2. `src/components/chatbot/AgentConfigPanel.tsx` — Default de maxTokens

Alterar o default de `maxTokens` de **500** para **4096** na configuracao inicial do agente. Os presets de 250/500 sao muito baixos para modelos com thinking:

- Default: 500 → 4096
- Presets: manter 250, 500, 1000 mas adicionar 4096 como opcao

### 3. `supabase/functions/execute-flow/index.ts` — Log de debug

Adicionar log do tamanho da resposta da AI e do `finishReason` retornado pelo Gemini, para facilitar debug futuro:

```typescript
const candidate = data.candidates?.[0];
console.log(`[FlowExecutor] AI response: ${candidate?.content?.parts?.[0]?.text?.length} chars, finishReason: ${candidate?.finishReason}`);
```

## Resumo

| Arquivo | Mudanca |
|---|---|
| `execute-flow/index.ts` (`callGoogleAI`) | Minimo 8192 tokens para modelos 2.5 + log de finishReason |
| `AgentConfigPanel.tsx` | Default maxTokens 500 → 4096, adicionar preset 4096 |

Apos a implementacao, o agente precisa ser re-salvo na tela de configuracao (ou o fix no backend ja garante o minimo de 8192 independente do valor salvo).

