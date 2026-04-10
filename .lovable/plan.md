

# Check-up Completo do Sistema — Bugs, Falhas e Melhorias

## Bugs e Falhas Encontrados

### 1. BUG CRITICO: `isWithinAllowedHours` usa UTC em vez de horário do Brasil
**Arquivo:** `supabase/functions/execute-campaign/index.ts` linha 56-60
**Problema:** A função `isWithinAllowedHours` usa `new Date()` diretamente, que retorna UTC no Edge Runtime. Se a campanha está configurada para 08:00-20:00 BRT, o sistema compara com horário UTC (3h a frente). Campanhas podem ser bloqueadas de manhã ou executar de madrugada.
**Contraste:** O `process-follow-ups` tem a função `getBrazilTime()` corretamente implementada, mas o `execute-campaign` não a usa.
**Correção:** Adicionar `getBrazilTime()` ao `execute-campaign` e usá-la em `isWithinAllowedHours`.

### 2. BUG: `sent_count` da campanha é calculado de forma incorreta (race condition)
**Arquivo:** `execute-campaign/index.ts` linha 418
**Problema:** O código faz `campaign.sent_count + campResult.sent + 1` — mas `campaign.sent_count` é o valor lido no início da execução. Se dois pollers rodam ao mesmo tempo, ambos leem o mesmo valor e sobrescrevem, perdendo contagens. Deveria usar uma função SQL incremental (`UPDATE SET sent_count = sent_count + 1`).
**Correção:** Usar `.rpc()` ou fazer `UPDATE campaigns SET sent_count = sent_count + 1`.

### 3. BUG: `process-follow-ups` não usa o módulo compartilhado `_shared/send-message.ts`
**Arquivo:** `supabase/functions/process-follow-ups/index.ts`
**Problema:** O follow-up tem sua própria implementação de `sendWhatsAppMessage` e `loadBaileysConfig` (linhas 8-46), duplicando código e não se beneficiando das correções feitas no módulo compartilhado (suporte a Meta API, LID, etc.). Se um contato só tem LID e não phone, o follow-up não formata corretamente o envio via Meta API.
**Correção:** Refatorar para importar de `_shared/send-message.ts`.

### 4. BUG: Deadlock potencial no `baileys-webhook` ao chamar `execute-flow`
**Arquivo:** `supabase/functions/baileys-webhook/index.ts` linha 769-786
**Problema:** O webhook chama `execute-flow` via HTTP (`fetch(flowUrl)`). Na VPS com processo único, isso é o mesmo problema de deadlock que foi corrigido no `execute-campaign`. Se o webhook e o `execute-flow` rodam no mesmo runtime, o request pode travar.
**Status:** Funciona na maioria dos casos porque o Baileys webhook é chamado externamente (pelo container Baileys), dando tempo ao runtime de processar. Mas sob carga alta pode causar timeout.
**Melhoria:** Importar `execute-flow` diretamente ou manter como está com timeout explícito.

### 5. BUG: Toggle de ativar/desativar agente na sidebar
**Arquivo:** `src/hooks/useFlows.ts` linha 86-113
**Problema:** O `useUpdateFlow` invalida `["chatbot-flows"]` e `["chatbot-flow", variables.id]`, mas o componente `FlowSidebar` que faz o toggle pode não estar usando a mesma key. A mutação não retorna dados (não tem `.select()`), então o cache pode ficar com dados stale até refetch.
**Correção:** Adicionar `.select().single()` na mutação de update e retornar os dados atualizados.

### 6. BUG: `campaign_contacts` status "sending" fica preso se a função crashar
**Arquivo:** `execute-campaign/index.ts` linha 209-214
**Problema:** Se a Edge Function crashar ou der timeout após marcar contatos como "sending", esses contatos ficam eternamente no status "sending" — nunca mais serão processados (o filtro busca `pending` ou `failed`).
**Correção:** Adicionar lógica de "claim timeout" — tratar contatos com status "sending" há mais de 10 minutos como "pending" novamente.

### 7. BUG MENOR: `CampaignContact` type não inclui "sending" como status
**Arquivo:** `src/hooks/useCampaigns.ts` linha 47
**Problema:** O tipo `status` define `'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'replied'` mas o backend usa "sending" como status intermediário. A UI pode não exibir contatos nesse estado corretamente.
**Correção:** Adicionar `'sending'` ao union type.

### 8. BUG MENOR: `execute-campaign` duplica `contacts` no SELECT sem verificar join
**Arquivo:** `execute-campaign/index.ts` linha 166
**Problema:** `.select("id, contact_id, status, retry_count, next_retry_at, contacts(id, name, phone, whatsapp_lid)")` — se `campaign_contacts` não tem foreign key para `contacts`, esse join vai falhar silenciosamente e `contact` será `null` para todos.
**Validação:** O banco não tem foreign keys em `campaign_contacts` (confirmado no schema). Porém o Supabase infere relações pelo nome `contact_id` → `contacts.id`. Funciona mas é frágil.

## Melhorias Recomendadas

### A. Contadores atômicos para `sent_count` e `failed_count`
Criar RPCs SQL para incrementar contadores atomicamente, eliminando race conditions:
```sql
CREATE FUNCTION increment_campaign_sent(campaign_id uuid) ...
```

### B. Recuperação de contatos "sending" travados
No início de cada execução de campanha, resetar contatos com `status = 'sending'` há mais de 10 minutos para `pending`.

### C. Unificar timezone para Brasil
Adicionar `getBrazilTime()` ao `execute-campaign` e usar consistentemente.

### D. Unificar lógica de envio no `process-follow-ups`
Importar `sendMessage` do `_shared/send-message.ts` em vez de duplicar código.

### E. Adicionar `.select()` ao `useUpdateFlow`
Para que o cache do React Query seja atualizado instantaneamente.

### F. Adicionar timeout explícito no fetch do `execute-flow`
No `baileys-webhook`, adicionar `AbortController` com timeout de 25s para evitar que o webhook trave.

## Plano de Implementação

| Prioridade | Mudança | Arquivo |
|---|---|---|
| 1 | Fix timezone Brazil no `execute-campaign` | `execute-campaign/index.ts` |
| 2 | Contadores atômicos `sent_count`/`failed_count` | Migration SQL + `execute-campaign/index.ts` |
| 3 | Recuperação de status "sending" travado | `execute-campaign/index.ts` |
| 4 | Adicionar "sending" ao type frontend | `src/hooks/useCampaigns.ts` |
| 5 | Unificar envio no `process-follow-ups` | `process-follow-ups/index.ts` |
| 6 | Fix `.select()` no `useUpdateFlow` | `src/hooks/useFlows.ts` |
| 7 | Timeout no fetch `execute-flow` | `baileys-webhook/index.ts` |

