

# Plano: 4 Correções no Chatbot e WhatsApp

## Problemas Identificados

### 1. "Agendar mensagem" na página WhatsApp
Opção existe em `src/pages/Atendimento.tsx` (linha 462) mas o módulo de agendamentos foi removido do projeto. Precisa remover o menu item e o dialog associado.

### 2. IA não responde (CRÍTICO)
O `execute-flow` (CASE 2, linha 1481-1528) procura triggers em `flow_nodes`/`flow_edges`, mas o novo sistema de Agentes de IA **não cria nodes/edges** — salva tudo na coluna `config` JSONB da tabela `chatbot_flows`. Quando `nodes.length === 0`, o loop faz `continue` e ignora o agente.

**Solução**: Antes de buscar em `flow_nodes`, verificar se o flow tem `config` com IA configurada. Se tiver, usar a config diretamente (triggerType, triggerValue, model, prompt, etc.) sem precisar de nodes/edges.

### 3. Bolinhas verdes inconsistentes
Na linha 414: `{ value: "trigger", active: !!config.triggerValue }` — mas para gatilhos tipo "nova conversa" ou "todas", `triggerValue` é vazio. Corrigir para considerar o `triggerType` também.

### 4. Delay de resposta da IA
Adicionar campo `responseDelay` (segundos) no `AgentConfig` e na UI, e implementar `await sleep(delay)` no execute-flow antes de enviar a resposta da IA.

---

## Alterações

### `src/pages/Atendimento.tsx`
- Remover a linha do `DropdownMenuItem` "Agendar mensagem" (linha 462)

### `src/components/atendimento/ConversationDialogs.tsx`
- Remover o dialog de agendamento e suas props

### `src/hooks/useAtendimentoState.ts`
- Remover estados `showScheduleDialog`, `scheduleTitle`, `scheduleDescription`, `scheduleDate`, `scheduleTime`

### `src/components/chatbot/AgentConfigPanel.tsx`
- Corrigir condição do dot "Gatilho": `active: config.triggerType === "new_conversation" || config.triggerType === "all" || !!config.triggerValue`
- Adicionar `responseDelay` (número, em segundos, default 0) ao `AgentConfig`
- Adicionar campo na aba "IA" para configurar delay (ex: "Tempo de espera antes de responder")

### `supabase/functions/execute-flow/index.ts`
- **CASE 2**: Adicionar lógica para agentes config-based:
  - Para cada flow ativo, se tem `config` com `aiEnabled: true`, verificar trigger direto (triggerType, triggerValue) sem depender de flow_nodes
  - Se trigger match, entrar no modo AI: buscar histórico, chamar `callAI`, enviar resposta, setar `flow_state` com `awaitingAIResponse`
  - Implementar `responseDelay` (sleep antes de responder)
- **CASE 1 (awaitingAIResponse)**: Implementar `responseDelay` também

