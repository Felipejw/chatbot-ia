

# Melhorias no Disparo em Massa: Respostas, Anti-Ban Extra, Input Numérico e Exportação CSV

## 1. Métrica de "Respondidas" nas Métricas

Adicionar coluna `replied_at` na tabela `campaign_contacts` e um novo status "replied". Quando um contato responde à conversa vinculada ao disparo, o webhook/baileys marca o `campaign_contact` como "replied". Na aba Métricas, adicionar card "Respondidas" com contagem e taxa de resposta.

- **DB Migration**: `ALTER TABLE campaign_contacts ADD COLUMN replied_at timestamptz;` + adicionar contagem `replied_count` na tabela `campaigns`
- **CampaignConfigPanel.tsx**: Adicionar stat "Respondidas" no grid de métricas, badge "Respondida" na lista de contatos, e taxa de resposta
- **useCampaigns.ts**: Atualizar interfaces com `replied_count` e status `replied`
- **baileys-webhook/index.ts** (ou meta-api-webhook): Ao receber mensagem incoming, verificar se o contato pertence a uma campanha ativa e marcar como `replied`

## 2. Métodos Anti-Ban Adicionais

Adicionar na aba Config:
- **Aquecimento gradual**: Opção para iniciar com poucos envios e aumentar progressivamente (ex: 50 no 1o dia, 100 no 2o, etc.). Campo `warmup_enabled` + `warmup_daily_increment`
- **Pausa aleatória longa**: Inserir pausas de 5-15min a cada X mensagens para simular comportamento humano. Campo `long_pause_every` + `long_pause_minutes`
- **Randomizar ordem dos contatos**: Checkbox para embaralhar a lista ao invés de enviar em ordem. Campo `shuffle_contacts`

- **DB Migration**: Adicionar colunas `warmup_enabled boolean default false`, `warmup_daily_increment int default 50`, `long_pause_every int default 0`, `long_pause_minutes int default 10`, `shuffle_contacts boolean default false`
- **CampaignConfigPanel.tsx**: Novos controles na seção Anti-Ban
- **execute-campaign/index.ts**: Implementar lógica de aquecimento, pausas longas e shuffle

## 3. Input Numérico ao Lado do Slider de Limite Diário

Adicionar um `<Input type="number">` ao lado do slider na linha 682-684 do CampaignConfigPanel, sincronizado bidireccionalmente com o slider.

## 4. Exportação CSV dos Resultados

Adicionar botão "Exportar CSV" na aba Métricas que gera e baixa um arquivo CSV com: Nome, Telefone, Status, Enviada em, Entregue em, Lida em, Respondida em, Erro.

- **CampaignConfigPanel.tsx**: Função `exportCSV()` que converte `campaignContactsList` em CSV e dispara download via `Blob` + `URL.createObjectURL`

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| DB Migration | Colunas: `replied_at`, `replied_count`, `warmup_enabled`, `warmup_daily_increment`, `long_pause_every`, `long_pause_minutes`, `shuffle_contacts` |
| `src/hooks/useCampaigns.ts` | Atualizar interfaces Campaign e CampaignContact |
| `src/components/campanhas/CampaignConfigPanel.tsx` | Stat "Respondidas", input numérico no slider, controles anti-ban extras, botão exportar CSV |
| `supabase/functions/execute-campaign/index.ts` | Lógica de aquecimento, pausas longas, shuffle |
| `supabase/functions/baileys-webhook/index.ts` | Marcar campaign_contact como replied ao receber resposta |

