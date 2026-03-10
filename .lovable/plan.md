

# Análise Completa e Melhorias do Sistema

## Problemas Identificados

### 1. Atendimento.tsx - Arquivo monolítico (2314 linhas)
O maior problema do sistema. Um único arquivo com ~50 estados, ~30 funções handler, e toda a UI inline. Causa re-renders excessivos, dificuldade de manutenção e lentidão.

### 2. Selects com valores vazios em AgentConfigPanel
Os selects de transferência (`transferQueueId`, `transferAgentId`, `transferFlowId`) usam valor padrão `""` (string vazia), causando o mesmo erro de Radix UI que já foi corrigido no `connectionId`. Warning no console confirma o problema.

### 3. Tabelas legadas no banco sem uso
`flow_nodes`, `flow_edges`, `chatbot_rules` ainda existem mas não são mais usadas após a remoção do flow builder.

### 4. Hook `useFlow` retorna `nodes` e `edges` vazios
`useFlows.ts` ainda retorna `nodes: []` e `edges: []` no `useFlow` — código morto do antigo canvas.

---

## Plano de Melhorias

### 1. Refatorar Atendimento.tsx em componentes menores
Extrair o arquivo monolítico em componentes focados:

- **`ConversationList.tsx`** — Lista de conversas com filtros, busca, tabs, bulk selection e pull-to-refresh (~400 linhas)
- **`ChatPanel.tsx`** — Área de chat com mensagens, input, emoji, quick replies (~600 linhas)
- **`ChatHeader.tsx`** — Header do chat com nome do contato, ações e indicadores (~150 linhas)
- **`MessageInput.tsx`** — Input de mensagem com attachments, gravação de áudio, emoji picker (~250 linhas)
- **`useAtendimentoState.ts`** — Custom hook centralizando os ~50 estados e handlers (~300 linhas)

O `Atendimento.tsx` ficaria com ~100 linhas, apenas compondo os sub-componentes.

### 2. Corrigir Selects com valores vazios no AgentConfigPanel
Aplicar o mesmo padrão do `connectionId` para `transferQueueId`, `transferAgentId` e `transferFlowId`:
- Usar valores sentinela (`"none"` ou similar) no lugar de `""`
- Converter de volta para `""` no `onValueChange`

### 3. Limpar hook useFlow
- Remover o retorno de `nodes` e `edges` do `useFlow`
- Retornar apenas o `flow` diretamente

### 4. Otimizações de performance
- Adicionar `React.memo` nos componentes de lista de conversas (cada item)
- Usar `useCallback` nos handlers de seleção de conversa
- Debounce no campo de busca de conversas (já existe busca, mas sem debounce)

### 5. Dashboard - adicionar gráfico de agentes de IA
O dashboard mostra apenas stats de conversas. Adicionar um card simples mostrando quantos agentes de IA estão ativos vs inativos.

---

## Arquivos alterados
- `src/pages/Atendimento.tsx` (refatorar em ~5 arquivos)
- `src/components/atendimento/ConversationList.tsx` (novo)
- `src/components/atendimento/ChatPanel.tsx` (novo)
- `src/components/atendimento/ChatHeader.tsx` (novo)
- `src/components/atendimento/MessageInput.tsx` (novo)
- `src/hooks/useAtendimentoState.ts` (novo)
- `src/components/chatbot/AgentConfigPanel.tsx` (fix selects)
- `src/hooks/useFlows.ts` (cleanup)
- `src/pages/Dashboard.tsx` (card de agentes IA)

## Prioridade sugerida
1. Fix selects vazios (bug ativo)
2. Refatorar Atendimento.tsx (maior impacto em fluidez)
3. Cleanup useFlows
4. Card de agentes no Dashboard

