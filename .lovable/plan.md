

# Fix: Disparo em Massa Não Executa na VPS

## Causa Raiz Identificada

O problema é um **deadlock no edge runtime da VPS**. 

Na VPS, todas as Edge Functions rodam **no mesmo processo Deno** (um único container `supabase-functions` com o router `index.ts`). Quando o `execute-campaign` chama `supabase.functions.invoke("send-whatsapp")`, essa chamada faz um HTTP request que passa pelo Kong e volta para o **mesmo processo Deno** que já está ocupado processando o `execute-campaign`. Resultado: o request do `send-whatsapp` fica na fila esperando, o `execute-campaign` fica esperando a resposta, e nada acontece — **deadlock**.

No Cloud do Supabase isso não acontece porque cada função roda em isolate separado.

```text
VPS (processo único):
  execute-campaign → HTTP → Kong → edge-runtime (bloqueado!) → 💀 timeout

Cloud (isolates separados):
  execute-campaign → HTTP → send-whatsapp (isolate novo) → ✅ funciona
```

## Solução

Modificar o `execute-campaign` para **importar diretamente** a lógica de envio via Baileys, em vez de chamar `send-whatsapp` por HTTP. Isso elimina o loopback e permite que tudo rode no mesmo processo sem deadlock.

Concretamente:
1. Extrair a lógica de envio (Baileys) do `send-whatsapp` para um módulo compartilhado (`_shared/send-message.ts`)
2. O `execute-campaign` importa e chama essa função diretamente, sem HTTP
3. O `send-whatsapp` também passa a usar o módulo compartilhado (sem duplicação de código)

## Mudanças

| Arquivo | O que muda |
|---|---|
| `supabase/functions/_shared/send-message.ts` | **Novo.** Módulo com a lógica de envio (Baileys + Meta), extraída do `send-whatsapp`. Exporta função `sendMessage(...)` reutilizável. |
| `supabase/functions/execute-campaign/index.ts` | Remove `supabase.functions.invoke("send-whatsapp")`. Importa e chama `sendMessage()` diretamente. Salva a mensagem no banco (insert em `messages`) igual ao `send-whatsapp` faz. |
| `supabase/functions/send-whatsapp/index.ts` | Refatora para usar o módulo `_shared/send-message.ts` (elimina duplicação). |
| `deploy/supabase/init.sql` | Sem mudança — o schema já está correto. |

## Benefícios Adicionais
- O disparo fica **muito mais rápido** (sem overhead de HTTP por mensagem)
- Elimina risco de timeout em cadeia
- Logs do `execute-campaign` ficam completos (sem erros engolidos pelo invoke)
- Funciona tanto na VPS quanto no Cloud

## Sobre o Cron
O frontend poller (`useCampaignPoller`) já está ativo e chamando `execute-campaign` a cada 60s. Com a correção do deadlock, o disparo vai começar a funcionar automaticamente. Para garantia extra na VPS, o usuário pode rodar `bash deploy/scripts/setup-cron.sh` para configurar o `pg_cron`.

