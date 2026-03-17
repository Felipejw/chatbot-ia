

# Melhorias no Disparo em Massa: Anti-Ban, Configurações e Dashboard

## Problemas identificados

1. **Faltam opções anti-ban**: Só tem intervalos e variações. Faltam: limite diário, horário permitido, pausa automática por falhas, seleção de conexão
2. **Dashboard mostra métricas globais**: O `CampaignMetricsDashboard` mostra métricas de TODAS as campanhas, não da campanha selecionada. Deveria mostrar os dados específicos da campanha aberta
3. **Faltam configurações úteis**: Conexão específica para envio, limite de envios por dia, pausa automática ao detectar falhas consecutivas

## Mudanças

### 1. Aba Config — Novas opções anti-ban

| Opção | Descrição |
|---|---|
| **Limite diário** | Máximo de mensagens por dia (ex: 200). Após atingir, pausa automaticamente |
| **Horário permitido** | Horário de início e fim para envio (ex: 08:00 - 20:00) |
| **Pausa por falhas** | Número de falhas consecutivas antes de pausar automaticamente (ex: 5) |
| **Conexão de envio** | Selecionar qual WhatsApp conectado usar (em vez de usar o default) |

Requer adicionar colunas na tabela `campaigns`: `daily_limit`, `allowed_hours_start`, `allowed_hours_end`, `max_consecutive_failures`, `connection_id`.

### 2. Aba Métricas — Dashboard específico da campanha

Substituir o dashboard global por um que mostra os dados da campanha selecionada:
- Contadores: Pendentes, Enviadas, Entregues, Lidas, Falhas (vindos de `campaign_contacts`)
- Barra de progresso geral
- Lista de contatos com status individual
- Manter o dashboard global acessível como visão geral

### 3. Edge function `execute-campaign` — Respeitar novas configs

Atualizar para verificar: limite diário, horário permitido, pausa por falhas consecutivas, e usar `connection_id` da campanha.

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| DB Migration | Adicionar colunas `daily_limit`, `allowed_hours_start`, `allowed_hours_end`, `max_consecutive_failures`, `connection_id` na tabela `campaigns` |
| `src/components/campanhas/CampaignConfigPanel.tsx` | Adicionar campos na aba Config (conexão, limite diário, horário, pausa por falhas) e refatorar aba Métricas para mostrar dados da campanha selecionada |
| `src/hooks/useCampaigns.ts` | Atualizar interface `Campaign` e mutations com novos campos |
| `supabase/functions/execute-campaign/index.ts` | Respeitar `connection_id`, `daily_limit`, horário permitido, pausa por falhas consecutivas |

