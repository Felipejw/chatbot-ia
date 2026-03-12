

# Adicionar suporte a OpenAI (ChatGPT) + seletor de provedor

## Situação atual

O sistema já suporta **Google Gemini** via API direta (com chave gratuita) e Lovable AI Gateway. Porém **não tem suporte direto a OpenAI/ChatGPT**. Para usar ChatGPT na VPS, o usuário precisa de uma **API key da OpenAI** (paga).

**Sobre as chaves de API**: Sim, você está correto. Ambos os provedores exigem chave:
- **Gemini**: chave gratuita em [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (já tem campo na UI)
- **ChatGPT (OpenAI)**: chave paga em [platform.openai.com/api-keys](https://platform.openai.com/api-keys) (precisa adicionar campo)

## Plano

### 1. Adicionar campo para OpenAI API Key na UI de Configurações
- Arquivo: `src/components/configuracoes/OptionsTab.tsx`
- Adicionar seção similar à do Google AI, com campo para `openai_api_key`, toggle de visibilidade, e link para obter a chave

### 2. Adicionar função `callOpenAI` nas Edge Functions
- Arquivos: `supabase/functions/execute-flow/index.ts` e `process-follow-ups/index.ts`
- Implementar chamada direta à API da OpenAI (`https://api.openai.com/v1/chat/completions`)
- Modelos suportados: `gpt-4o-mini`, `gpt-4o`, `gpt-4-turbo`

### 3. Atualizar `callAI` para rotear por provedor
- Na função `callAI`, detectar se o modelo começa com `gpt-` → usar `callOpenAI` com chave do `system_settings`
- Se começa com `gemini-` → usar `callGoogleAI` como já funciona

### 4. Atualizar seletor de modelos no AgentConfigPanel
- Arquivo: `src/components/chatbot/AgentConfigPanel.tsx`
- Adicionar modelos OpenAI ao `<Select>`:
  - `gpt-4o-mini` (Recomendado, mais barato)
  - `gpt-4o` (Mais capaz)
  - `gpt-4-turbo` (Rápido)
- Agrupar visualmente: "Google Gemini (Gratuito)" e "OpenAI ChatGPT (Pago)"

### 5. Atualizar `process-follow-ups` com mesmo suporte
- Mesmo padrão: detectar modelo `gpt-*` → buscar `openai_api_key` do `system_settings` → chamar API OpenAI

### Arquivos alterados
- `src/components/configuracoes/OptionsTab.tsx` — campo para OpenAI API Key
- `src/components/chatbot/AgentConfigPanel.tsx` — modelos GPT no seletor
- `supabase/functions/execute-flow/index.ts` — função `callOpenAI` + roteamento
- `supabase/functions/process-follow-ups/index.ts` — mesmo suporte OpenAI

