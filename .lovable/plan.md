

# Ajuste: Mensagens mais naturais (chunks + intervalos)

## Problemas atuais
1. **Split muito rígido** — só divide em parágrafos (`\n\n`). Se a IA responde sem quebras duplas, vai tudo em 1 mensagem.
2. **Mensagens curtas não dividem** — threshold de 300 chars é muito baixo; respostas de 400-600 chars (comuns) ficam em 1 bloco.
3. **Intervalo entre mensagens** (1.5-3.5s) pode ser mais realista com variação por tamanho do chunk.

## Correções propostas

### Arquivo: `supabase/functions/execute-flow/index.ts`

**`splitLongMessage` (linhas 56-102)** — Reescrever com lógica mais inteligente:

- **Threshold para não dividir**: apenas mensagens com menos de **150 chars** ficam em 1 mensagem (saudações rápidas)
- **Divisão por parágrafos E por frases**: primeiro tenta `\n\n`, depois `\n`, e por fim sentenças (`.!?`)
- **Target de 2-3 chunks**: mensagens de 150-600 chars → 2 chunks; acima de 600 → 3 chunks
- **Chunks balanceados**: distribui parágrafos/frases de forma mais equilibrada

**Intervalos (linhas 1350, 1867, 2102)** — Delay proporcional ao tamanho do chunk:
- Fórmula: `Math.min(chunk.length * 15, 2000) + 800 + Math.random() * 1500`
- Chunks curtos (~50 chars): ~1.5-2.5s (digitação rápida)
- Chunks médios (~150 chars): ~2.5-4.5s (leitura + digitação)
- Chunks longos (~200+ chars): ~3-5s (cap para não demorar demais)

Isso simula o tempo de digitação real de um humano.

### Resumo das alterações
- Reescrever `splitLongMessage` com threshold menor (150 chars), divisão por `\n`, frases, e melhor balanceamento
- Trocar delay fixo por delay proporcional ao tamanho do chunk nos 3 pontos de envio

