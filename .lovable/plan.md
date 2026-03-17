

# Fix: Colunas faltantes na tabela `campaigns` da VPS

## Problema
O erro **"Column 'allowed_hours_end' of relation 'campaigns' does not exist"** indica que a tabela `campaigns` na VPS foi criada a partir do `init.sql` antigo, que não contém as colunas mais recentes (anti-ban, conexão, flow, métricas de resposta, etc.).

## Colunas faltantes na VPS

A tabela na VPS tem apenas as colunas originais. Faltam:
- `daily_limit`, `allowed_hours_start`, `allowed_hours_end`
- `max_consecutive_failures`, `connection_id`, `flow_id`
- `warmup_enabled`, `warmup_daily_increment`
- `long_pause_every`, `long_pause_minutes`
- `shuffle_contacts`, `replied_count`
- `campaign_contacts.replied_at`

## Solução (2 partes)

### 1. Atualizar `deploy/supabase/init.sql`
Adicionar todas as colunas faltantes na definição da tabela `campaigns` e `campaign_contacts`, além das políticas RLS granulares. Assim novas instalações já terão tudo.

### 2. Criar script de migração para VPS existentes
Adicionar um arquivo `deploy/supabase/migrations/add_campaign_columns.sql` que usa `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` para cada coluna faltante. Também adiciona as políticas RLS granulares que foram criadas nas migrações recentes. O script `update.sh` já existente pode aplicar isso.

| Arquivo | Mudança |
|---|---|
| `deploy/supabase/init.sql` | Atualizar CREATE TABLE campaigns com todas as colunas + políticas RLS granulares |
| `deploy/supabase/migrations/add_campaign_columns.sql` | Script ALTER TABLE ADD COLUMN IF NOT EXISTS para VPS existentes + políticas RLS |

Isso resolve o erro imediatamente ao rodar a migração na VPS, e previne o problema em instalações futuras.

