

# Melhorias e Modificações no Sistema

## Resumo das mudanças

1. Remover aba "Grupos" do WhatsApp (Atendimento)
2. Remover CRM (rota `/kanban`, sidebar, node CRM do chatbot)
3. Remover Agendamentos (rota `/agendamentos`, sidebar, node Schedule do chatbot)
4. Integrar Disparo em Massa ao Chatbot -- campanhas disparam para um agente de IA selecionado
5. Renomear "Chatbot" para "Agentes de IA" em todo o sistema

## Alterações por arquivo

### 1. `src/pages/Atendimento.tsx`
- Remover a aba/tab "Grupos" (`value="groups"`) do TabsList
- Remover o filtro de grupos no `filteredConversations` e `tabCounts`
- Manter a lógica `is_group` no código apenas para ignorar grupos silenciosamente

### 2. `src/components/layout/AppSidebar.tsx`
- Remover item `{ title: "CRM", href: "/kanban", ... }` da seção "Atendimento"
- Remover item `{ title: "Agendamentos", href: "/agendamentos", ... }` da seção "Atendimento"
- Mover `{ title: "Disparo em Massa", href: "/campanhas", ... }` para dentro da seção do Chatbot ou agrupado
- Renomear "Chatbot" para "Agentes de IA"
- Remover imports não utilizados (`Calendar`, `Kanban`)

### 3. `src/App.tsx`
- Remover rota `/kanban` e import `Kanban`
- Remover rota `/agendamentos` e import `Agendamentos`

### 4. `src/hooks/usePermissions.ts`
- Remover módulos `kanban` e `agendamentos` dos arrays `MODULES` e `ROUTE_TO_MODULE`

### 5. `src/components/chatbot/NodePalette.tsx`
- Remover node `crm` e `schedule` da lista de blocos disponíveis

### 6. `src/components/chatbot/FlowCanvas.tsx`
- Remover imports de `CRMNode` e `ScheduleNode`
- Remover `crm` e `schedule` do objeto `nodeTypes`

### 7. `src/components/chatbot/NodeConfigPanel.tsx`
- Remover `case "crm"` e `case "schedule"` do switch de configuração
- Remover import `useKanbanColumns`

### 8. `src/pages/Campanhas.tsx`
- Adicionar seletor de "Agente de IA" (flow/chatbot_flow) ao criar/editar campanha
- Buscar lista de flows ativos com `useFlows()` e permitir selecionar qual agente de IA será usado no disparo
- Salvar o `flow_id` associado à campanha (requer coluna nova na tabela `campaigns`)

### 9. `src/components/chatbot/FlowSidebar.tsx`
- Renomear textos de "Chatbot" / "Fluxo" para "Agente de IA"

### 10. Páginas/arquivos a deletar
- `src/pages/Kanban.tsx`
- `src/pages/Agendamentos.tsx`
- `src/components/chatbot/nodes/CRMNode.tsx`
- `src/components/chatbot/nodes/ScheduleNode.tsx`
- `src/hooks/useKanban.ts`
- `src/hooks/useKanbanColumns.ts`
- `src/hooks/useSchedules.ts`

### 11. Migração SQL
- Adicionar coluna `flow_id UUID` na tabela `campaigns` para vincular campanha a um agente de IA

### Arquivos alterados
- `src/App.tsx`
- `src/components/layout/AppSidebar.tsx`
- `src/hooks/usePermissions.ts`
- `src/pages/Atendimento.tsx`
- `src/pages/Campanhas.tsx`
- `src/components/chatbot/NodePalette.tsx`
- `src/components/chatbot/FlowCanvas.tsx`
- `src/components/chatbot/FlowSidebar.tsx`
- `src/components/chatbot/NodeConfigPanel.tsx`
- `src/components/chatbot/nodes/ValidationBadge.tsx` (remover `validateCRMNode`)
- Deletar ~7 arquivos
- 1 migração SQL

