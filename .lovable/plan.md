

# Respostas e Plano

## 1. Salvar agente de IA atualiza?

**Sim, atualiza em tempo real.** O botão "Salvar" grava a configuração na coluna `config` (JSONB) da tabela `chatbot_flows` no banco de dados. A edge function `execute-flow` lê essa configuração do banco toda vez que processa uma mensagem. Ou seja, ao salvar, a próxima mensagem já usará as novas configurações (prompt, modelo, temperatura, etc.) sem precisar reiniciar nada.

## 2. Auto-tagging por IA -- já existe no backend, falta o toggle na UI

A funcionalidade de auto-tagging já está implementada na edge function `execute-flow`. Ela:
- Verifica a setting `auto_tag_enabled` no banco
- Busca as tags cadastradas
- Usa IA para classificar a conversa e aplicar as tags automaticamente

Porém, **não existe um toggle na interface** para ativar/desativar isso. A setting `auto_tag_enabled` precisa ser criada no banco e a UI precisa de um controle.

### Plano: Adicionar toggle de Auto-Tag na aba Opções

**Arquivo:** `src/components/configuracoes/OptionsTab.tsx`

- Adicionar um novo `SettingOption` na seção de IA/Bot com label "Auto-tagging por IA" e key `auto_tag_enabled`
- Valores: `true` (Habilitado) / `false` (Desabilitado)
- Ao alterar, salvar via `createOrUpdateSetting` (mesmo padrão usado pelos outros toggles)

**Dica importante:** Para que a auto-classificação funcione bem, as tags cadastradas devem ter **descrições claras** (ex: "Interesse em compra", "Suporte técnico", "Agendamento"). A IA usa o nome e a descrição da tag para decidir qual aplicar.

### Resumo das alterações
- `src/components/configuracoes/OptionsTab.tsx` -- adicionar toggle "Auto-tagging por IA" com setting key `auto_tag_enabled`

