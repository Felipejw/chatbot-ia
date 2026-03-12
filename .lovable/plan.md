
## Objetivo
Corrigir de forma definitiva 3 coisas que hoje “parecem não funcionar”, mas na prática estão falhando por motivos diferentes:
1) **Áudio (PTT) e mídia no geral**: o download direto do Baileys está sendo interpretado com um formato JSON errado, então o sistema não consegue obter o arquivo para salvar/transcrever.
2) **Imagem (entrada)**: mesmo quando a imagem chega, o fluxo do agente não faz “visão” (descrever a imagem) antes de mandar para a IA — ele só envia “[Imagem]”/legenda.
3) **Follow-up**: está **agendando** mas **não envia** por dois fatores comuns em VPS: cron chamando URL “externa” (TLS/DNS/rede) e janela de horário/dias com **timezone** (pode ficar “sempre fora da janela” e nunca dispara). Além disso, follow-up com mídia tem bug de payload.

---

## Diagnóstico (o que encontrei no código)
### 1) Bug crítico: formato do endpoint de mídia do Baileys
O Baileys self-hosted retorna no endpoint:
- `GET /sessions/:name/messages/:messageId/media` → **`{ success: true, data: { base64, mimetype } }`**

Mas hoje várias partes do app esperam:
- `json.base64` e `json.mimetype` (no “top level”)

Isso faz com que:
- **download direto no front** (`MediaAutoDownloader`) falhe;
- **download inline no webhook** (`baileys-webhook`) falhe;
- **fallback do execute-flow** (PTT quando `mediaUrl` vem null) falhe;
- **edge function `download-whatsapp-media`** falhe.

Resultado: áudio/imagem/documento podem virar “mídia indisponível” e a IA recebe só `"[Áudio]"`/`"[Imagem]"`.

### 2) Imagem: falta etapa de “visão”
O `execute-flow` só trata multimodal para **áudio** (transcrição). Para **imagem**, ele não baixa a mídia nem chama Gemini multimodal para descrever a foto.

### 3) Follow-up: “agenda mas não envia”
O `process-follow-ups` até existe e envia via Baileys, mas na VPS normalmente falha por:
- **Cron (pg_cron + pg_net)** chamando URL externa (domínio/https). Dentro do container do Postgres isso pode falhar por rede/DNS/TLS.
- **Timezone / janela de envio**: `isWithinAllowedWindow()` usa horário do servidor; se a VPS estiver em UTC, pode ficar sempre fora e o follow-up fica “pendente para sempre” (e o código atual só dá `continue`, sem reagendar).
- **Bug adicional**: `sendWhatsAppMedia()` no `process-follow-ups` envia `{ url, type }`, mas o Baileys espera `{ mediaUrl, mediaType }` (isso quebra follow-ups com mídia).

---

## O que vou implementar (mudanças)
### A) Padronizar o parser do retorno do Baileys (corrige áudio/imagem/documentos)
Atualizar todos os pontos que consomem `/messages/:id/media` para aceitar os dois formatos:
- Novo (real): `json.data.base64` / `json.data.mimetype`
- Legado (se existir): `json.base64` / `json.mimetype`

Arquivos:
- `src/components/atendimento/MediaAutoDownloader.tsx`
- `supabase/functions/baileys-webhook/index.ts`
- `supabase/functions/execute-flow/index.ts`
- `supabase/functions/download-whatsapp-media/index.ts`

Implementação:
- Criar uma função util local em cada contexto (ou replicada) tipo `extractBase64Payload(json)` que retorna `{ base64, mimetype } | null`.
- Logar explicitamente quando o JSON não tem base64, para facilitar suporte.

Impacto:
- O sistema volta a conseguir **baixar e salvar mídia** quando não veio base64 no webhook (caso típico do PTT).
- O auto-download no chat para exibir mídia também melhora.

---

### B) Fazer a IA “entender imagens” (visão → texto)
Adicionar no `execute-flow` um tratamento análogo ao áudio, para quando:
- `messageType === "image"` e existe `mediaUrl` **ou** existe `baileysMessageId` (fallback).

Fluxo:
1) Obter a imagem (prioridade):
   - baixar do **storage** se `mediaUrl` existir e conseguir extrair o `storagePath`;
   - senão, baixar direto do Baileys via `baileysMessageId`;
2) Converter para base64 e detectar `contentType`;
3) Chamar Gemini multimodal (direto com `google_ai_api_key` quando existir):
   - prompt: “Descreva objetivamente o conteúdo da imagem…” (sem inventar).
4) Substituir a mensagem enviada para IA por algo como:
   - `[Descrição da imagem]: ...` + (se houver legenda, anexar: `Legenda: ...`)

Arquivos:
- `supabase/functions/execute-flow/index.ts`

Notas de design:
- Vou generalizar `downloadAudioFromBaileys` para algo como `downloadMediaFromBaileys(...)` (serve para áudio e imagem).
- Vou manter o fallback “peça para enviar em texto” apenas quando **falhar** obter a mídia.

---

### C) Consertar follow-up (envio real)
#### C1) Corrigir payload de envio de mídia do follow-up
No `process-follow-ups`, ajustar `sendWhatsAppMedia()` para enviar:
- `{ to, mediaUrl, caption, mediaType }`
em vez de `{ to, url, type, caption }`

Arquivo:
- `supabase/functions/process-follow-ups/index.ts`

#### C2) Cron mais robusto na VPS: usar URL interna + service role
Ajustar `deploy/scripts/setup-cron.sh` para:
- usar `url := 'http://kong:8000/functions/v1/process-follow-ups'` (rede interna Docker, sem TLS)
- enviar `Authorization: Bearer ${SERVICE_ROLE_KEY}` (em vez de ANON_KEY)

Arquivo:
- `deploy/scripts/setup-cron.sh`

Por que isso resolve:
- elimina dependência do domínio externo/https (que pode falhar dentro do container do Postgres).
- reduz risco de o runtime rejeitar token se a verificação estiver habilitada.

#### C3) Timezone + reagendamento quando fora da janela
Melhorar `isWithinAllowedWindow()` para usar horário “Brasil” (mesma lógica que já existe no `execute-flow`), e quando estiver fora da janela:
- **reagendar** `scheduled_at` para a próxima janela válida (ex.: próximo dia permitido às `allowed_hours_start`)
- manter status `pending`

Arquivo:
- `supabase/functions/process-follow-ups/index.ts`

Isso elimina o sintoma clássico: “está pendente, mas nunca envia”.

#### C4) Botão de disparo manual (diagnóstico rápido)
Adicionar na UI de Follow-up um botão “Processar agora” que chama a função `process-follow-ups` manualmente e exibe o resultado (processed/totalPending).
Isso não substitui o cron, mas acelera muito validação e diagnóstico.

Arquivo:
- `src/pages/FollowUp.tsx`

---

## Plano de testes (end-to-end)
1) **Imagem (entrada)**:
   - enviar uma foto para o WhatsApp conectado
   - verificar se:
     - a mensagem é salva como `message_type=image`
     - `media_url` fica preenchido (ou o fallback via Baileys funciona)
     - o bot responde com base na **descrição** (não mais “não consigo ver imagens” / nem só “[Imagem]”)
2) **Áudio PTT (entrada)**:
   - enviar um PTT curto
   - verificar se:
     - a transcrição acontece e entra no prompt como `[Transcrição do áudio]: ...`
3) **Follow-up**:
   - habilitar follow-up para 1 etapa em 1–2 minutos
   - aguardar e confirmar envio automático
   - se necessário, apertar “Processar agora” e conferir que ele envia e marca `status=sent`
4) **Follow-up fora de horário**:
   - configurar janela curta (ou simular) e verificar se, ao cair fora, ele **reagenda** em vez de ficar travado.

---

## Arquivos que serão alterados
- `src/components/atendimento/MediaAutoDownloader.tsx` (parse correto do JSON do Baileys)
- `supabase/functions/baileys-webhook/index.ts` (parse correto do JSON do Baileys ao baixar mídia inline)
- `supabase/functions/execute-flow/index.ts` (download/parse correto + visão para imagens + reuso do fallback Baileys)
- `supabase/functions/download-whatsapp-media/index.ts` (parse correto do JSON do Baileys)
- `supabase/functions/process-follow-ups/index.ts` (payload send/media correto + timezone + reagendamento)
- `deploy/scripts/setup-cron.sh` (cron apontando para `http://kong:8000` + token `SERVICE_ROLE_KEY`)
- `src/pages/FollowUp.tsx` (botão “Processar agora”)

---

## Observações importantes
- Não vou expor `SERVICE_ROLE_KEY` no frontend; ela só será usada no cron (VPS) e no backend.
- Essas correções atacam a causa raiz (parser do Baileys + falta de visão + cron interno + timezone), então tendem a resolver **áudio, imagem e follow-up** de uma vez, em vez de “tapar buraco”.
