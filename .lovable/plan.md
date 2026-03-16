

# Correção: IA ignora base de conhecimento (links, preços, etc.)

## Problema raiz

A base de conhecimento é anexada ao system prompt com um cabeçalho fraco: `### Base de conhecimento:\n{conteúdo}`. A IA interpreta isso como informação de referência secundária e gera respostas genéricas com placeholders como `[*INSERIR O SEU LINK DE COMPRA AQUI*]` em vez de usar os dados reais (link, preço, nome do produto).

Isso acontece em **3 funções** que montam o prompt:
- `callGoogleAI` (linha 241-243)
- `callLovableAI` (linha 307-309)
- `callOpenAI` (linha 901-903)

## Correção

Trocar o cabeçalho genérico por uma instrução explícita e imperativa que force a IA a usar as informações literalmente.

### Arquivo: `supabase/functions/execute-flow/index.ts`

**Em `callGoogleAI` (linhas 241-243), `callLovableAI` (linhas 307-309) e `callOpenAI` (linhas 901-903):**

Substituir:
```typescript
const fullSystemPrompt = knowledgeBase 
  ? `${systemPrompt}\n\n### Base de conhecimento:\n${knowledgeBase}`
  : systemPrompt;
```

Por:
```typescript
const fullSystemPrompt = knowledgeBase 
  ? `${systemPrompt}\n\n---\nINFORMAÇÕES OBRIGATÓRIAS (use EXATAMENTE como estão, NUNCA substitua por placeholders, NUNCA invente dados diferentes):\n\n${knowledgeBase}`
  : systemPrompt;
```

Essa mudança simples faz a IA tratar o conteúdo da base de conhecimento como dados factuais obrigatórios — links, preços, nomes — em vez de "material de referência" que pode ser resumido ou substituído por templates.

