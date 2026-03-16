

# Correção: IA formata links com Markdown (colchetes/parênteses) no WhatsApp

## Problema

A IA está respondendo com links em formato Markdown `[https://url](https://url)` que não funciona no WhatsApp. O WhatsApp precisa de URLs em texto puro para auto-linkar.

## Causa

Falta uma regra explícita no `buildFullSystemPrompt` instruindo a IA a **nunca usar formatação Markdown** para links.

## Alterações

### 1. `supabase/functions/execute-flow/index.ts` — `buildFullSystemPrompt`

Adicionar regra 6 nas `=== REGRAS ===`:

```
6. NUNCA formate links com Markdown. NÃO use [texto](url) nem (url). Envie links como texto puro. Ex: https://exemplo.com
```

### 2. `supabase/functions/test-agent/index.ts` — `buildFullSystemPrompt`

Mesma regra adicionada para manter consistência no ambiente de teste.

| Arquivo | Mudança |
|---|---|
| `execute-flow/index.ts` | Adicionar regra anti-Markdown no prompt do sistema |
| `test-agent/index.ts` | Mesma regra anti-Markdown |

