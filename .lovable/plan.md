

# Substituir Flow Builder por Tela de Configuração de Agente de IA

## Conceito

Trocar o canvas de arrastar-e-soltar (ReactFlow) por uma tela de configuração direta. Ao selecionar um agente na sidebar, em vez de ver um canvas com blocos, o usuário verá um formulário organizado em seções com todas as opções de configuração do agente.

## Nova Estrutura da Tela

```text
┌──────────────┬──────────────────────────────────────────┐
│  Sidebar     │  Configuração do Agente                  │
│  (lista de   │                                          │
│  agentes)    │  [Geral] Nome, descrição, ativo/inativo  │
│              │  [Gatilho] Tipo + valor                  │
│              │  [IA] Modelo, prompt, temperatura, etc   │
│              │  [WhatsApp] Número vinculado             │
│              │  [Transferência] Para fila/agente/IA     │
│              │  [Encerramento] Msg final, resolver      │
│              │                                          │
│              │  [Salvar]                                │
└──────────────┴──────────────────────────────────────────┘
```

## Alterações

### 1. Criar `src/components/chatbot/AgentConfigPanel.tsx` (novo)
- Formulário com seções em cards/accordion:
  - **Geral**: nome, descrição, ativo/inativo
  - **Gatilho**: tipo (palavra-chave, frase, nova conversa) + valor
  - **Configuração da IA**: toggle ativar, API key própria, modelo, system prompt, temperatura, max tokens, base de conhecimento
  - **WhatsApp**: selecionar conexão/número
  - **Transferência**: tipo (fila, atendente, WhatsApp, outro agente IA) + destinos
  - **Encerramento**: mensagem final, marcar como resolvido
- Botão "Salvar" que persiste tudo como um único registro (reusar `flow_nodes` ou salvar direto no `chatbot_flows` com coluna `config`)
- Reaproveitar toda a lógica de campos que já existe no `NodeConfigPanel.tsx`

### 2. Migração SQL
- Adicionar coluna `config JSONB DEFAULT '{}'` na tabela `chatbot_flows` para armazenar configuração do agente diretamente, sem precisar de nodes/edges separados

### 3. Atualizar `src/pages/Chatbot.tsx`
- Remover imports de `FlowCanvas`, `NodeConfigPanel`
- Ao selecionar agente, renderizar `AgentConfigPanel` em vez do canvas
- Simplificar drasticamente o estado (remover nodeUpdateFn, nodeDeleteFn, saveFn, etc.)

### 4. Atualizar `src/hooks/useFlows.ts`
- Adicionar campo `config` ao tipo `ChatbotFlow`
- Criar mutation `useUpdateFlowConfig` para salvar o JSON de configuração
- Manter `useFlows`, `useCreateFlow`, `useDeleteFlow` (já funcionam)

### 5. Arquivos a deletar
- `src/components/chatbot/FlowCanvas.tsx`
- `src/components/chatbot/NodePalette.tsx`
- `src/components/chatbot/NodeConfigPanel.tsx`
- `src/components/chatbot/nodes/TriggerNode.tsx`
- `src/components/chatbot/nodes/DelayNode.tsx`
- `src/components/chatbot/nodes/TransferNode.tsx`
- `src/components/chatbot/nodes/EndNode.tsx`
- `src/components/chatbot/nodes/AINode.tsx`
- `src/components/chatbot/nodes/WhatsAppNode.tsx`
- `src/components/chatbot/nodes/ValidationBadge.tsx`

### 6. Dependências
- Pode-se remover `@xyflow/react` do package.json (verificar se não é usado em outro lugar)

### Arquivos alterados
- `src/pages/Chatbot.tsx` (simplificar)
- `src/hooks/useFlows.ts` (adicionar config)
- `src/components/chatbot/FlowSidebar.tsx` (manter como está)
- Novo: `src/components/chatbot/AgentConfigPanel.tsx`
- 1 migração SQL (coluna `config` em `chatbot_flows`)
- Deletar ~10 arquivos de nodes/canvas

