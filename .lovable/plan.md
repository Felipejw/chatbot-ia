

# Melhorias em Agentes de IA

## Mudanças

### 1. Adicionar opção "Transferir para outra IA" no bloco Transferir

**Arquivos:** `NodeConfigPanel.tsx`, `TransferNode.tsx`, `ValidationBadge.tsx`

- Adicionar `SelectItem value="ai"` com label "Outro Agente de IA" no select de tipo de transferência
- Quando `transferType === "ai"`, mostrar select com lista de flows (agentes) usando `useFlows()`
- Salvar `flowId` e `flowName` no node data
- No `TransferNode.tsx`, adicionar ícone `Brain` para tipo "ai" e exibir nome do agente
- No `ValidationBadge.tsx`, validar que `flowId` está preenchido quando tipo é "ai"
- Importar `useFlows` no `NodeConfigPanel.tsx`

### 2. Remover blocos Menu e Mensagem

**Arquivos:** `NodePalette.tsx`, `FlowCanvas.tsx`, `NodeConfigPanel.tsx`, `ValidationBadge.tsx`

- Remover `message` e `menu` do array `sidebarNodeTypes` em `NodePalette.tsx`
- Remover imports `MessageNode` e `MenuNode` e suas entradas no `nodeTypes` em `FlowCanvas.tsx`
- Remover `case "message"` e `case "menu"` do `renderFields()` em `NodeConfigPanel.tsx`
- Remover funções auxiliares de menu (`handleAddOption`, `handleRemoveOption`, `handleOptionChange`)
- Remover `validateMessageNode` e `validateMenuNode` de `ValidationBadge.tsx`
- Remover `"message"` e `"menu"` do `getTitle()` em `NodeConfigPanel.tsx`
- Remover imports não utilizados (`MessageSquare`, `List`, `Image`, `Video`, `FileText`)

**Arquivos a deletar:**
- `src/components/chatbot/nodes/MenuNode.tsx`
- `src/components/chatbot/nodes/MessageNode.tsx`

### Arquivos alterados
- `src/components/chatbot/NodePalette.tsx`
- `src/components/chatbot/FlowCanvas.tsx`
- `src/components/chatbot/NodeConfigPanel.tsx`
- `src/components/chatbot/nodes/TransferNode.tsx`
- `src/components/chatbot/nodes/ValidationBadge.tsx`
- Deletar 2 arquivos de nodes

