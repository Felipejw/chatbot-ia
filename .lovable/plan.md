

# Plano: Corrigir transcrição de áudio que não funciona na VPS

## Diagnóstico

A IA responde "não consigo processar áudios" porque a transcrição está falhando silenciosamente. O fluxo atual:

1. Baileys envia webhook com `type: "ptt"` (voice note)
2. Webhook mapeia corretamente para `msgType = "audio"` e tenta armazenar a mídia
3. Webhook envia `messageType: "audio"` e `mediaUrl` para `execute-flow`
4. `execute-flow` tenta transcrever SE `mediaUrl` existe

**O problema provavel**: O `mediaUrl` chega como `null` porque o download/armazenamento da mídia falha no webhook (problema comum no Docker). Quando `mediaUrl` é null, a transcrição nem é tentada. A mensagem `"[Áudio]"` vai direto para a IA, que responde dizendo que não consegue processar áudios.

**Segundo problema**: Mesmo quando `mediaUrl` existe, a URL é relativa (`/storage/v1/...`) e dentro do Docker o `SUPABASE_URL` aponta para `http://kong:8000`, que pode não conseguir servir o arquivo.

## Solução

### 1. Fallback direto no `execute-flow` quando `mediaUrl` é null

Quando `messageType === "audio"` mas `mediaUrl` é null, tentar baixar o áudio diretamente do servidor Baileys (que ainda tem a mensagem no `messageStore`), fazer o upload no storage, e depois transcrever.

### 2. Melhorar resolução de URL na `transcribeAudio`

Usar `SUPABASE_SERVICE_ROLE_KEY` para acessar o storage via API autenticada em vez de URL pública, garantindo que funcione dentro do Docker.

### 3. Adicionar logs detalhados de diagnóstico

Logs em cada etapa para identificar exatamente onde falha.

### 4. Fallback gracioso no prompt

Quando a transcrição falha completamente, em vez de enviar `"[Áudio]"` para a IA (que gera a resposta "não consigo processar"), enviar uma mensagem mais contextualizada que faça a IA pedir ao contato para enviar em texto sem dizer que "não aceita áudio".

## Alterações

**`supabase/functions/execute-flow/index.ts`**:
- Adicionar função `downloadAudioFromBaileys()` que busca o áudio diretamente do servidor Baileys quando `mediaUrl` é null
- Na `transcribeAudio()`: usar download autenticado do storage (com service_role_key) em vez de URL pública
- No handler principal: quando `messageType === "audio"` e `mediaUrl` é null, tentar download via Baileys antes de desistir
- Melhorar fallback: quando transcrição falha, usar `"[O contato enviou um áudio. Peça gentilmente que repita a mensagem em texto, explicando que você está processando a conversa e precisa da mensagem escrita.]"` em vez de `"[Áudio]"`

**`supabase/functions/baileys-webhook/index.ts`**:
- Adicionar logs mais detalhados no fluxo de download de mídia para diagnóstico
- Passar o `messageId` original do Baileys para o execute-flow (necessário para download direto)

## Arquivos alterados
- `supabase/functions/execute-flow/index.ts` -- fallback de download, melhoria de URL, logs
- `supabase/functions/baileys-webhook/index.ts` -- passar messageId, logs extras

