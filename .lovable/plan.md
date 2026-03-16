

# Adicionar indicador "digitando..." no WhatsApp antes de cada chunk

## O que será feito

Adicionar o status "composing" (digitando...) no WhatsApp antes de enviar cada chunk de mensagem, usando a API nativa do Baileys `sendPresenceUpdate('composing', jid)`.

## Alterações

### 1. Baileys Server — nova função + rota (`deploy/baileys/src/baileys.ts` e `deploy/baileys/src/index.ts`)

**`baileys.ts`** — Exportar nova função `sendPresenceUpdate`:
```typescript
export async function sendPresence(sessionName: string, to: string, presence: 'composing' | 'paused' | 'available') {
  const session = sessions.get(sessionName);
  if (!session || session.status !== 'connected') return;
  const jid = formatJid(to);
  await session.sock.sendPresenceUpdate(presence, jid);
}
```

**`index.ts`** — Nova rota `POST /sessions/:name/presence`:
```
POST /sessions/:name/presence
Body: { to: "5511...", presence: "composing" }
```

### 2. Edge Function — chamar presença antes de cada chunk (`supabase/functions/execute-flow/index.ts`)

Nova função auxiliar `sendTypingPresence`:
```typescript
async function sendTypingPresence(config: BaileysConfig, phone: string) {
  try {
    const headers = { "Content-Type": "application/json" };
    if (config.apiKey) headers["X-API-Key"] = config.apiKey;
    await fetch(`${config.serverUrl}/sessions/${config.sessionName}/presence`, {
      method: "POST", headers,
      body: JSON.stringify({ to: phone, presence: "composing" })
    });
  } catch (e) { /* silently ignore */ }
}
```

Nos 3 pontos de envio de chunks (linhas ~1351, ~1868, ~2103), adicionar antes de cada `sendWhatsAppMessage`:
```typescript
for (let i = 0; i < aiChunks.length; i++) {
  await sendTypingPresence(baileysConfig, phone);  // ← novo
  await new Promise(r => setTimeout(r, humanTypingDelay(aiChunks[i]))); // delay ANTES de enviar
  await sendWhatsAppMessage(baileysConfig, phone, aiChunks[i]);
}
```

O delay agora fica **antes** do envio (não depois), para que o "digitando..." apareça durante o tempo de espera — exatamente como um humano faz.

### Resumo
| Arquivo | Mudança |
|---|---|
| `deploy/baileys/src/baileys.ts` | Nova função `sendPresence` exportada |
| `deploy/baileys/src/index.ts` | Nova rota POST `/sessions/:name/presence` |
| `supabase/functions/execute-flow/index.ts` | Nova `sendTypingPresence` + chamada antes de cada chunk nos 3 pontos |

**Nota:** Após aprovar, será necessário fazer rebuild do Baileys no VPS (`docker-compose build && docker-compose up -d`) para a nova rota funcionar.

