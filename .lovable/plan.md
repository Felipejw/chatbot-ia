

# Correção: Teste de Agente retorna "Nenhum provedor disponível"

## Causa raiz

A edge function `test-agent` tem dois problemas:

1. **Sem fallback para OpenAI** — Se o modelo é Gemini mas a chamada à API do Google falha (ex: chave inválida, erro de rede), o código tenta apenas o Lovable AI Gateway como fallback. Na VPS, o `LOVABLE_API_KEY` não existe → cai na mensagem "Nenhum provedor disponível". A chave OpenAI do usuário (visível no screenshot) nunca é consultada.

2. **Erros silenciosos** — Se a chamada à API Google retorna erro (status != 200), o código simplesmente ignora sem logar o motivo. Impossível debugar.

## Alterações

### `supabase/functions/test-agent/index.ts`

1. **Adicionar fallback para OpenAI**: Após falhar o Google, tentar a chave `openai_api_key` da `system_settings` antes do Lovable Gateway
2. **Logar erros das chamadas de API**: Se Google ou OpenAI retornarem erro, logar status + body para diagnóstico
3. **Incluir info de debug no diagnóstico**: Retornar qual provedor foi usado (ou por que nenhum funcionou)

```typescript
// Ordem de tentativas:
// 1. Google AI (se modelo não é gpt-*)
// 2. OpenAI (se modelo é gpt-* OU se Google falhou)  ← NOVO
// 3. Lovable AI Gateway (fallback final)
```

| Arquivo | Mudança |
|---|---|
| `supabase/functions/test-agent/index.ts` | Adicionar fallback OpenAI, logging de erros, diagnóstico de provedor |

