

# Correção: IA não mostra link e repete "olá" toda mensagem

## Causa raiz

### Bug 1 — `callOpenAI` usa campo errado no histórico (linha 955)
```typescript
// ERRADO — sender_type não existe em ChatMessage, sempre undefined → tudo vira "assistant"
role: msg.sender_type === "contact" ? "user" : "assistant",

// CORRETO
role: msg.role,
```

O histórico inteiro é enviado como mensagens do assistente. A IA não consegue distinguir perguntas do cliente das suas próprias respostas. Resultado: ignora perguntas e repete padrões antigos.

### Bug 2 — Nenhuma regra contra repetir saudações
O prompt do sistema não instrui a IA a evitar cumprimentar novamente quando a conversa já está em andamento. Com o histórico bugado, isso piora.

## Alterações

### 1. `supabase/functions/execute-flow/index.ts` — `callOpenAI` (linha 955)
Trocar `msg.sender_type === "contact" ? "user" : "assistant"` por `msg.role`.

### 2. `supabase/functions/execute-flow/index.ts` — `buildFullSystemPrompt`
Adicionar regra 5: "NÃO repita saudações (olá, oi, tudo bem) se a conversa já começou. Vá direto ao ponto."

### 3. `supabase/functions/execute-flow/index.ts` — Log de debug no `callOpenAI`
Adicionar log do histórico enviado para facilitar debug futuro.

## Resultado esperado
- OpenAI recebe histórico correto (user/assistant) → consegue responder perguntas sobre link, preço etc.
- IA para de cumprimentar a cada mensagem
- Funciona igual para todos os provedores (Google, Lovable, OpenAI)

