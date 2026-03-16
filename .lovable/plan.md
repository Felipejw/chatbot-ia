

# Prevenção de problemas recorrentes com Agentes de IA

## Problemas recorrentes identificados

1. **Sem forma de testar** — Toda mudança exige enviar mensagem pelo WhatsApp e esperar. Impossível debugar rapidamente.
2. **Sem visibilidade** — Não dá para ver qual prompt/modelo/histórico está sendo enviado à IA.
3. **Fetch duplicado** — O RESUME path busca `chatbot_flows.config` duas vezes (linhas 1898 e 1913).
4. **Cache desnecessário** — `flow_state.aiNodeData` continua sendo salvo na conversa, criando confusão entre "cacheado" vs "atualizado".

## Plano de melhorias

### 1. Botão "Testar Agente" no painel de configuração

Adicionar um botão no `AgentConfigPanel.tsx` que abre um mini-chat de teste. Envia a mensagem diretamente para a edge function `execute-flow` com um `conversationId` de teste (ou simula a chamada `callAI` via uma nova edge function leve `test-agent`).

- Nova edge function `test-agent`: recebe `{ flowId, message, history[] }`, busca o config do flow, chama `callAI`, retorna a resposta.
- UI: campo de texto + botão "Enviar" + área de respostas no próprio painel do agente.
- Permite validar se o link aparece, se a saudação se repete, etc., **sem usar WhatsApp**.

### 2. Log de diagnóstico no RESUME path

No `execute-flow/index.ts`, após resolver o prompt final:
```typescript
console.log("[FlowExecutor] RESUME effective config:", {
  promptLength: systemPrompt.length,
  promptPreview: systemPrompt.substring(0, 200),
  model,
  historyCount: conversationHistory.length,
});
```

### 3. Consolidar fetch duplicado

Combinar as duas chamadas à `chatbot_flows` (config + delay) em uma única query, reutilizando o resultado.

### 4. Parar de cachear `aiNodeData` no `flow_state`

No trigger INITIAL, salvar apenas `flowId` no `aiNodeData` mínimo (model/prompt vazios). O RESUME path já busca o config mais recente — não precisa de fallback cacheado.

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/test-agent/index.ts` | Nova edge function para testar agente sem WhatsApp |
| `src/components/chatbot/AgentConfigPanel.tsx` | Adicionar mini-chat de teste |
| `supabase/functions/execute-flow/index.ts` | Consolidar fetch duplicado, logs de diagnóstico, limpar cache |
| `supabase/functions/main/index.ts` | Registrar `test-agent` no router |

