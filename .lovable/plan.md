

# Diagnóstico: IA responde "picotado" e não termina

## Causa raiz

O problema é o **`maxTokens` padrão de 1024** no `execute-flow/index.ts`. Quando a IA gera uma resposta longa (como explicações detalhadas), ela atinge o limite de tokens e **corta a resposta no meio da frase** -- exatamente o que aparece no screenshot ("Me desculpe novamente pela inter...", "Ótima pergunta! É super...").

Isso acontece em 3 pontos do código:
- Linha 220: `maxOutputTokens: maxTokens || 1024` (Google AI)
- Linha 285: `max_tokens: maxTokens || 1024` (Lovable AI)
- Linha 1286: `const maxTokens = (currentNode.data.maxTokens as number) || 1024` (config default)

1024 tokens equivale a aproximadamente 750 palavras -- insuficiente para respostas conversacionais detalhadas.

## Solução (2 partes)

### 1. Aumentar o `maxTokens` padrão de 1024 para 4096

Editar `supabase/functions/execute-flow/index.ts`:
- Linha 1286: trocar `|| 1024` por `|| 4096`
- Linhas 220, 285: trocar fallback `|| 1024` por `|| 4096`

Isso garante que a IA tenha espaço suficiente para completar respostas sem cortar.

### 2. Dividir respostas longas em múltiplas mensagens

WhatsApp suporta até ~65k caracteres, mas mensagens muito longas ficam difíceis de ler. Adicionar uma função `splitLongMessage` que:
- Divide em blocos de ~4000 caracteres
- Corta em parágrafos (`\n\n`) para manter coerência
- Envia cada bloco como mensagem separada com pequeno delay entre elas

Aplicar nos 2 pontos onde `sendWhatsAppMessage` é chamado com `aiResponse` (linhas 1298 e 1810).

## Arquivos a editar
- `supabase/functions/execute-flow/index.ts` -- aumentar maxTokens default e adicionar split de mensagens longas

