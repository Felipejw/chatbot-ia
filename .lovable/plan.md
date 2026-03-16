

# Correção: IA não reconhece prompt e mensagens picotadas

## Problemas identificados

### 1. Prompt ignorado / respostas curtas demais
Na seção do **config-based agent** (linhas 2048-2086), o `maxTokens` está com fallback de **500** em dois lugares:
- Linha 2052: `maxTokens: cfg.maxTokens || 500` (ao salvar no flow_state)
- Linha 2080: `cfg.maxTokens || 500` (ao chamar callAI)

Com 500 tokens (~375 palavras), a IA não tem espaço para usar o prompt/knowledge base adequadamente e corta a resposta antes de completar. Isso explica por que ela "não reconhece" informações do prompt — ela é forçada a responder de forma tão curta que não consegue incorporar todo o contexto.

### 2. Mensagens ainda picotadas no primeiro trigger
Na linha 2088, a resposta da IA é enviada **diretamente sem `splitLongMessage`**:
```typescript
await sendWhatsAppMessage(baileysConfig, formattedPhone, aiResponse); // SEM split!
```
O `splitLongMessage` foi aplicado nos caminhos de flow-nodes (linha 1336) e resumo de AI (linha 1853), mas **não** no caminho do config-based agent na primeira interação.

## Correções

### Arquivo: `supabase/functions/execute-flow/index.ts`

**Correção 1** — Linha 2052: trocar `cfg.maxTokens || 500` por `cfg.maxTokens || 4096`

**Correção 2** — Linha 2080: trocar `cfg.maxTokens || 500` por `cfg.maxTokens || 4096`

**Correção 3** — Linhas 2088-2093: aplicar `splitLongMessage` na resposta, substituindo o envio direto por:
```typescript
const aiChunks = splitLongMessage(aiResponse);
for (let i = 0; i < aiChunks.length; i++) {
  await sendWhatsAppMessage(baileysConfig, formattedPhone, aiChunks[i]);
  if (i < aiChunks.length - 1) await new Promise(r => setTimeout(r, 1000));
}
```

Após implementação, rodar `update-remote.sh` na VPS para deploy.

