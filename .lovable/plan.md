

# Simplificar prompt: campo único + parar de "vou verificar"

## Problema identificado

1. **A instrução no backend manda a IA dizer "vou verificar"** — linha 273 do `execute-flow/index.ts`: `"Se a informação não estiver abaixo, diga que vai verificar"`. Isso causa exatamente o comportamento reportado.
2. **Dois campos separados (prompt + base de conhecimento)** confundem a configuração. O usuário quer apenas um campo.

## Alterações

### 1. `src/components/chatbot/AgentConfigPanel.tsx` — Unificar campos

- Remover o card "Base de conhecimento" (linhas 912-925)
- No campo "Prompt do sistema", ao salvar pela primeira vez após a mudança, mesclar automaticamente o conteúdo existente de `knowledgeBase` ao final do `systemPrompt` (se `knowledgeBase` não estiver vazio)
- Aumentar o textarea do prompt para `rows={16}` para acomodar mais conteúdo
- Atualizar placeholder e label para deixar claro que tudo vai nesse campo

### 2. `supabase/functions/execute-flow/index.ts` — Corrigir `buildFullSystemPrompt`

- Mesclar `knowledgeBase` no prompt sem as regras que mandam "dizer que vai verificar"
- Quando a IA não souber algo, instruir: **"responda de forma breve e neutra, sem prometer verificar ou retornar depois"**
- Simplificar as regras para:

```
REGRAS:
1. Use TODAS as informações do prompt acima nas suas respostas.
2. NUNCA use placeholders como [INSERIR], {link}, "SEU LINK AQUI".
3. Se não souber algo, dê uma resposta curta e neutra. 
   NUNCA diga "vou verificar", "vou consultar" ou "já te retorno".
4. Copie valores literais (links, preços, nomes) exatamente como estão.
```

### 3. Migração automática no frontend

No `useEffect` que carrega o config, se `knowledgeBase` tiver conteúdo:
- Concatenar ao `systemPrompt` com separador claro
- Limpar `knowledgeBase`
- Marcar `hasChanges = true` para que o usuário salve

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `AgentConfigPanel.tsx` | Remover campo "Base de conhecimento", migrar conteúdo para prompt, textarea maior |
| `execute-flow/index.ts` | Corrigir `buildFullSystemPrompt` — remover instrução de "vou verificar", resposta neutra |

