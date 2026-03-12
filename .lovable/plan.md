

# Corrigir Follow-up: Tabela ausente na VPS + Logs de diagnóstico

## Diagnóstico definitivo

Analisei todos os arquivos e confirmei a causa raiz:

**A tabela `follow_ups` NÃO existe no `deploy/supabase/init.sql`.** Este é o script que cria o banco na VPS. As migrations que criam a tabela (`supabase/migrations/20260310213556_...`) só existem no Lovable Cloud e **nunca são aplicadas na VPS**.

Consequência direta: quando o `execute-flow` roda na VPS e tenta `INSERT INTO follow_ups`, o insert falha silenciosamente (ou é ignorado), e nenhum follow-up é criado no banco da VPS.

**Sobre o "Processar agora"**: o botão chama `supabase.functions.invoke()` que aponta para o Lovable Cloud (não para a VPS). Os logs do Cloud confirmam: `Total pending follow-ups in DB: 0` -- correto, pois nunca foi criado nada lá.

**Sobre o chatbot_flows**: a query ao Cloud mostra o flow "IA TESTE" com `config: {}` (vazio, sem followUpEnabled). O flow real "IA BR" com follow-up habilitado existe apenas na VPS.

## Solução

### 1. Adicionar tabela `follow_ups` completa ao `deploy/supabase/init.sql`

Incluir a definição completa da tabela (com TODAS as colunas, incluindo as adicionadas por migrations posteriores), índices e RLS. Usar `CREATE TABLE IF NOT EXISTS` para ser idempotente.

### 2. Adicionar logs de diagnóstico no `execute-flow`

Adicionar `console.log` explícito antes e depois do insert de follow-up para capturar erros na VPS (atualmente os erros podem ser silenciosos se a tabela não existir).

### 3. Melhorar o feedback do "Processar agora" na UI

O botão deve mostrar informação mais clara: se há 0 pendentes, mostrar "Nenhum follow-up pendente" em vez de sugerir erro.

## Arquivos a editar
- `deploy/supabase/init.sql` -- adicionar tabela `follow_ups` com todas as colunas, índices e RLS
- `supabase/functions/execute-flow/index.ts` -- adicionar logs antes/depois do insert
- `src/pages/FollowUp.tsx` -- melhorar feedback do "Processar agora"

## Passo após implementação
Rodar `update-remote.sh` na VPS e executar manualmente o SQL da tabela `follow_ups` no banco da VPS (via `docker exec ... psql`), já que o `init.sql` só roda na primeira inicialização.

