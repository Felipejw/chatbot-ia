
# Correção: IA ainda ignora partes do prompt mesmo com Gemini 2.5 Pro

## Diagnóstico
O problema agora não parece ser só o modelo. Há dois pontos no backend que ainda atrapalham:

1. A base de conhecimento já foi reforçada, mas ainda entra como um bloco grande e pouco estruturado.
2. O sistema envia até 10 mensagens anteriores da conversa para a IA, incluindo respostas antigas do próprio bot. Se uma resposta errada com placeholder já entrou no histórico, o Gemini tende a reaproveitar esse padrão.

Isso explica por que “mesmo após atualizar” a resposta continua errada na mesma conversa.

## O que vou ajustar

### 1. Reforçar a montagem do prompt no backend
Arquivo: `supabase/functions/execute-flow/index.ts`

Vou substituir o bloco atual por uma estrutura mais forte, separando claramente:

- Regras de comportamento
- Fatos oficiais obrigatórios
- Instrução explícita para responder usando valores literais
- Proibição de placeholders, textos-modelo e invenções

Exemplo de efeito esperado:
- Se perguntarem link, retornar exatamente o link cadastrado
- Se perguntarem preço, retornar exatamente `R$97,00`
- Se perguntarem garantia, retornar exatamente `7 dias`

### 2. Sanitizar o histórico antes de enviar para a IA
Arquivo: `supabase/functions/execute-flow/index.ts`

Vou ajustar a preparação do `conversationHistory` para evitar contaminação por respostas ruins anteriores:

- Remover mensagens do assistente com padrões de placeholder/template
  - `[*...*]`
  - `INSERIR`
  - `substituir este texto`
- Priorizar mensagens do cliente no contexto
- Reduzir o peso de respostas anteriores do bot quando houver base de conhecimento

Isso mantém contexto da conversa sem deixar um erro antigo dominar as próximas respostas.

### 3. Aplicar a mesma regra em todos os provedores suportados
Arquivo: `supabase/functions/execute-flow/index.ts`

A correção será aplicada de forma consistente em:
- Google AI
- Lovable AI
- OpenAI

Assim o comportamento fica igual independente do provedor/modelo selecionado.

## O que não precisa mudar
- Sem mudanças no banco
- Sem mudanças na tela do agente
- Sem mudanças no split em chunks ou no “digitando...”

## Resultado esperado
Depois dessa correção, o agente deve:
- usar corretamente link, preço, garantia e demais fatos do prompt/base
- parar de repetir placeholders de respostas antigas
- responder de forma mais confiável mesmo em conversas já iniciadas

## Validação
Vou considerar o ajuste correto quando estes testes passarem:

1. Em conversa nova:
- “qual o link de compra?”
- “qual o valor?”
- “tem garantia?”

2. Em conversa antiga já contaminada:
- repetir as mesmas perguntas e confirmar que não volta placeholder

3. Confirmar que as respostas continuam curtas e divididas em chunks como antes
