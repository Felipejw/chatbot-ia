

# Diagnóstico: Erro persistente na página Follow-up

## Causa raiz

O erro persiste porque **depende de onde você está acessando**:

### No Preview (Lovable Cloud)
A tabela `follow_ups` existe e está acessível (confirmei: retorna 0 registros sem erro). Se o erro aparece aqui, é porque o usuário **não está autenticado** no preview — as políticas de segurança da tabela `follow_ups` exigem o role `authenticated`, diferente das outras tabelas que usam `public`. Sem sessão válida, as queries falham silenciosamente e `isError` fica `true`.

### Na VPS (ambiente real)
A tabela `follow_ups` **ainda não foi criada** no banco da VPS. O comando `docker compose up -d` restaurou os containers, mas **não executou o patch SQL** com a definição da tabela. Toda query à `follow_ups` retorna erro 404/relation not found.

## Solução definitiva (2 partes)

### 1. Corrigir RLS da tabela `follow_ups`
As políticas atuais usam role `{authenticated}` em vez de `{public}` (que é o padrão usado em TODAS as outras tabelas do projeto). Isso causa inconsistência. Trocar para `{public}` com `auth.uid() IS NOT NULL` (mesmo padrão das demais tabelas) resolve o problema no preview.

**Ação**: Migration para dropar as 2 policies existentes e recriá-las com role `public` (mesmo padrão das tabelas `conversations`, `contacts`, etc.).

### 2. Adicionar service_role policy para Edge Functions
As Edge Functions (como `process-follow-ups` e `execute-flow`) usam `service_role` key, que bypassa RLS automaticamente. Porém, na VPS o `execute-flow` pode estar usando anon key em alguns caminhos. Adicionar uma policy explícita para `service_role` garante acesso total.

**Ação**: Adicionar policy `Service role full access` na migration.

### 3. Melhorar resiliência do hook `useFollowUpMetrics`
Atualmente, se UMA das 3 queries falha, a página inteira mostra erro. Melhorar para que cada seção funcione independentemente — se a query de "agentes" falha mas "contagens" funciona, mostrar o que for possível em vez de bloquear tudo.

**Ação**: Editar `useFollowUpMetrics.ts` para retornar `isError` por seção e `FollowUp.tsx` para mostrar dados parciais.

## Arquivos a editar
- **Migration SQL**: dropar e recriar RLS policies com role `public`
- `src/hooks/useFollowUpMetrics.ts`: retornar erros granulares por seção
- `src/pages/FollowUp.tsx`: mostrar dados parciais quando possível
- `deploy/supabase/init.sql`: atualizar as policies para manter consistência com VPS

