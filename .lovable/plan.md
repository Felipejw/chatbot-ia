

# Analise Completa do Projeto

## Estado Geral: Funcional, com pontos de atenção

Analisei o dashboard, os widgets, hooks, edge functions e a arquitetura de deploy VPS. Abaixo o resumo completo.

---

## O que está funcionando corretamente

1. **Dashboard** -- Stats cards (5), ActivityChart, TeamPerformance, ChannelChart, RecentConversations todos renderizam corretamente com loading states e empty states
2. **StatsCard e EmptyState** -- Já corrigidos com `React.forwardRef` (sem warnings de ref)
3. **Skeleton count** -- Corrigido para 5 (corresponde aos 5 cards)
4. **Auto-tagging por IA** -- Edge function `execute-flow` chama `autoTagConversation` corretamente com tratamento de erro não-bloqueante (`.catch(() => {})`)
5. **Unique constraint** em `conversation_tags` -- Migração aplicada, suporta `upsert` com `onConflict`
6. **Autenticação e RLS** -- Todas as tabelas têm RLS ativado com policies adequadas
7. **Rotas protegidas** -- Todas usam `ProtectedRoute` com verificação de módulo

---

## Problemas Identificados

### 1. ChannelChart pode perder dados (limite de 1000 linhas)
O `useChannelStats` faz `supabase.from("conversations").select("channel")` sem paginação. Se houver mais de 1000 conversas, o gráfico de pizza ficará incompleto.

**Correção**: Usar `select('*', { count: 'exact', head: true })` por canal, similar ao `useDashboardStats`, ou usar um `group by` via RPC.

### 2. RecentConversations usa FK inexistente
A query `assignee:profiles!conversations_assigned_to_fkey` referencia uma foreign key que **não existe** na tabela `conversations` (a coluna `assigned_to` não tem FK para `profiles`). Isso pode causar erro silencioso ou falhar.

**Correção**: Remover a hint de FK e usar relação implícita, ou criar a FK no banco.

### 3. `useTeamPerformance` também busca todas as conversas
Mesma limitação de 1000 linhas -- se ultrapassar, os dados de performance ficam incorretos.

---

## Tudo salva no banco de dados interno da VPS?

**Sim, 100%.** A arquitetura garante isso:

- O arquivo `deploy/supabase/init.sql` cria todas as tabelas, enums, funções e triggers no PostgreSQL local da VPS (container `supabase-db`)
- O `docker-compose.yml` persiste os dados em `./volumes/db/data` (volume local)
- O script `deploy/scripts/update.sh` substitui o `.env` por valores locais, forçando a aplicação a conectar ao banco da VPS (não ao Lovable Cloud)
- Storage de arquivos fica em `./volumes/storage` (local)
- Sessões do Baileys ficam em `./volumes/baileys/sessions` (local)
- Backups automáticos via `deploy/scripts/backup.sh` fazem dump do PostgreSQL local

Resumindo: ao fazer deploy na VPS, **todos os dados ficam no banco PostgreSQL local** dentro do Docker. Nenhum dado depende do Lovable Cloud em produção.

---

## Plano de Correção (3 itens)

### 1. Corrigir ChannelChart -- usar contagem por canal sem limite de 1000 linhas
- Substituir `select("channel")` por queries `head: true, count: 'exact'` por canal (como já é feito em `useDashboardStats`)

### 2. Corrigir FK do RecentConversations
- Remover `!conversations_assigned_to_fkey` da query e usar relação sem hint, ou usar query separada para o assignee

### 3. Corrigir useTeamPerformance -- usar contagem eficiente
- Substituir busca de todas as conversas por queries com `count` agrupadas por `assigned_to` e `status`

### Arquivos alterados
- `src/components/dashboard/ChannelChart.tsx`
- `src/hooks/useDashboardStats.ts`

