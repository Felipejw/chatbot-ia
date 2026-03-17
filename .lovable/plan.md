

# Fix: Follow-up não processa automaticamente na VPS + Envio pela conexão errada

## Diagnóstico

Existem **dois problemas**:

### 1. Follow-up não processa sozinho na VPS
O cron do Lovable Cloud roda a cada minuto, mas encontra **0 dados** (os dados estão no banco da VPS). Na VPS, o `setup-cron.sh` precisa ter sido executado manualmente para configurar `pg_cron`. Se não foi executado (ou se `pg_cron`/`pg_net` não estão disponíveis), o follow-up só processa quando você clica "Processar agora".

**Solução**: Adicionar um **polling automático no frontend** como fallback. Quando o usuário está logado, a página de Atendimento (que fica aberta) vai chamar `process-follow-ups` a cada 60 segundos automaticamente. Isso garante o processamento independente de `pg_cron`.

### 2. Follow-up envia pela conexão errada
O `process-follow-ups` busca a conexão via `conversations(*, connections(*))`. Se a conversa não tem `connection_id` ou se a conexão original está offline, ele usa a conexão padrão (`is_default = true`). Quando você tem múltiplos WhatsApps conectados, isso faz o follow-up ser enviado pelo WhatsApp errado.

**Solução**: O follow-up já salva `connection_id` no registro. Priorizar usar a `connection_id` do follow-up em vez da conexão da conversa, para garantir que a mensagem saia pelo mesmo WhatsApp que originou o atendimento.

## Mudanças

| Arquivo | Mudança |
|---|---|
| `src/hooks/useFollowUpPoller.ts` | **Novo**: Hook que chama `process-follow-ups` a cada 60s enquanto o usuário está logado |
| `src/components/layout/AppLayout.tsx` | Adicionar o hook de polling |
| `supabase/functions/process-follow-ups/index.ts` | Priorizar `followUp.connection_id` sobre `conversation.connections` para garantir envio pela conexão correta |

