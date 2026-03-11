

# Plano: Follow-up Completo + Renomear Sistema para "WhatzApp IA"

## 1. Renomear sistema de "TalkFlow" para "WhatzApp IA"

Trocar todas as referências ao nome antigo:

- **`index.html`** — title, meta tags og:title, author
- **`src/pages/Login.tsx`** — fallback `"TalkFlow"` → `"WhatzApp IA"`
- **`src/pages/RecuperarSenha.tsx`** — mesmo fallback
- **`src/pages/NotFound.tsx`** — mesmo fallback
- **`src/pages/ApiDocs.tsx`** — textos de documentação
- **`src/components/layout/AppSidebar.tsx`** — fallback do platformName
- **`src/components/layout/AppLayout.tsx`** — fallback do platformName
- **`src/hooks/useApplyBranding.ts`** — DEFAULT_BRANDING.platform_name
- **`src/components/configuracoes/ApiKeysTab.tsx`** — texto da descrição
- **Migração SQL** — UPDATE system_settings SET value = 'WhatzApp IA' WHERE key = 'platform_name'

## 2. Expandir configuração de Follow-up no AgentConfigPanel

Transformar a seção de Follow-up de básica para extremamente completa, adicionando:

### Novos campos de configuração
- **Intervalo por etapa individual** — ao invés de um intervalo único, permitir configurar intervalo diferente para cada etapa (ex: etapa 1 = 30min, etapa 2 = 2h, etapa 3 = 24h)
- **Unidade de tempo selecionável** — select de minutos/horas/dias ao lado do input de intervalo
- **Horário permitido para envio** — início e fim (ex: 08:00 às 20:00), para não enviar follow-ups de madrugada
- **Dias da semana permitidos** — checkboxes seg-dom
- **Mensagem de encerramento** — mensagem final quando todos os follow-ups acabam e a ação é "encerrar"
- **Preview da timeline** — visualização gráfica das etapas mostrando quando cada follow-up será enviado
- **Condição de parada** — além de "contato respondeu", opção de parar se conversa foi atribuída a humano
- **Modelo de IA específico para follow-up** — select de modelo separado do agente principal (para usar modelo mais barato)
- **Temperatura da IA do follow-up** — controle separado

### Interface expandida
- Cada etapa vira um card individual com: número, intervalo próprio, mensagem (fixa) ou indicação (IA), preview
- Botão de adicionar/remover etapa dinâmico
- Badge mostrando tempo total do ciclo de follow-up
- Indicadores visuais de status por etapa na timeline

### Arquivos alterados
- **`src/components/chatbot/AgentConfigPanel.tsx`** — seção Follow-up completamente refeita
- **`src/hooks/useFollowUps.ts`** — atualizar interface para novos campos
- **`supabase/functions/process-follow-ups/index.ts`** — suportar intervalos por etapa, horários permitidos, dias da semana
- **Migração SQL** — adicionar colunas `allowed_hours_start`, `allowed_hours_end`, `allowed_days`, `follow_up_model`, `follow_up_temperature`, `closing_message`, `step_intervals` na tabela follow_ups

### Arquivos para renomear sistema (10 arquivos)
- `index.html`, `src/pages/Login.tsx`, `src/pages/RecuperarSenha.tsx`, `src/pages/NotFound.tsx`, `src/pages/ApiDocs.tsx`, `src/components/layout/AppSidebar.tsx`, `src/components/layout/AppLayout.tsx`, `src/hooks/useApplyBranding.ts`, `src/components/configuracoes/ApiKeysTab.tsx`
- 1 migração SQL para atualizar o valor no banco

