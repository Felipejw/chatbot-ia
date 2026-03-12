

# Plano: Transcrição de áudio para IA + Correção do Follow-Up

## Problema 1: IA não "escuta" áudios

**Causa**: O webhook envia `messageContent = "[Áudio]"` e `mediaUrl` para o `execute-flow`, mas o execute-flow **não recebe** `mediaUrl` nem `messageType` — apenas o campo `message`. Logo a IA recebe literalmente o texto "[Áudio]" e não tem como entender o conteúdo.

**Solução**: Usar a API multimodal do Gemini (que aceita áudio nativamente) ou transcrever o áudio com a API do Google antes de enviar à IA.

### Alterações

**`supabase/functions/baileys-webhook/index.ts`** (linha ~727)
- Passar `messageType: msgType` e `mediaUrl` no body enviado ao `execute-flow`

**`supabase/functions/execute-flow/index.ts`**
- Receber `messageType` e `mediaUrl` do request body
- Quando `messageType === "audio"` e `mediaUrl` existe:
  1. Baixar o áudio do storage
  2. Enviar ao Gemini como input multimodal (áudio + texto) para transcrição inline
  3. Usar o texto transcrito como `message` para o fluxo de IA
- Fallback: se transcrição falhar, usar "[O contato enviou um áudio que não pôde ser transcrito]"

## Problema 2: Follow-up não envia após 5 minutos

**Causa provável**: O `process-follow-ups` está configurado via `pg_cron` apontando para a URL do **Lovable Cloud** (`tnazkkontuwhyhvjjytt.supabase.co`), mas na VPS do usuário o Supabase tem outra URL. O cron job precisa existir no banco da VPS apontando para a URL local.

Além disso, verificando os logs do `process-follow-ups` no Lovable Cloud, ele só faz boot/shutdown sem processar nada — porque não há follow-ups na tabela do Cloud (os dados estão na VPS).

### Alterações

**`deploy/supabase/init.sql`**
- Adicionar criação do cron job para `process-follow-ups` usando variáveis locais da VPS (SUPABASE_URL e ANON_KEY do `.env`)

**`deploy/scripts/update-remote.sh`** (ou `bootstrap.sh`)
- Garantir que o cron job é criado/atualizado no banco da VPS após deploy, apontando para a URL correta do Supabase local

**`supabase/functions/process-follow-ups/index.ts`**
- Adicionar logs mais detalhados para debug (quantidade de follow-ups encontrados, status)

## Arquivos alterados
- `supabase/functions/baileys-webhook/index.ts` — enviar mediaUrl e messageType ao execute-flow
- `supabase/functions/execute-flow/index.ts` — transcrever áudio via Gemini antes de processar
- `deploy/scripts/setup-cron.sh` (novo) — script para configurar o cron job na VPS
- `deploy/scripts/update-remote.sh` — chamar setup-cron após deploy

