

# Correção: Coluna `config` no init.sql + IA gratuita via Google Gemini

## Dois problemas a resolver

### 1. Erro ao salvar fluxo do Chatbot (VPS)
A tabela `chatbot_flows` no `deploy/supabase/init.sql` **não tem a coluna `config`** (linhas 473-483). O `AgentConfigPanel` tenta salvar `config: config as any` (linha 387), causando erro no banco da VPS.

### 2. IA sem funcionar na VPS
Atualmente, o `execute-flow` e `process-follow-ups` usam o Lovable AI Gateway (`ai.gateway.lovable.dev`) com `LOVABLE_API_KEY`, que **não existe na VPS**. O código já tem a função `callGoogleAI` pronta para chamar a API do Google Gemini diretamente, mas precisa de uma chave configurada.

A Google oferece a **API do Gemini gratuitamente** em [aistudio.google.com](https://aistudio.google.com/apikey).

---

## Plano

### 1. Adicionar coluna `config` no init.sql
- Arquivo: `deploy/supabase/init.sql` (linha 482)
- Adicionar `config jsonb DEFAULT '{}'::jsonb` na definição da tabela `chatbot_flows`

### 2. Adicionar migration para o Cloud
- Migration SQL: `ALTER TABLE chatbot_flows ADD COLUMN IF NOT EXISTS config jsonb DEFAULT '{}'::jsonb;`

### 3. Permitir configurar Google AI API Key na UI (Configurações)
- Arquivo: `src/components/configuracoes/OptionsTab.tsx`
- Adicionar campo para salvar a `google_ai_api_key` na tabela `system_settings`
- Isso permite que o admin configure a chave sem acesso ao servidor

### 4. Alterar `execute-flow` para usar Google AI como fallback
- Arquivo: `supabase/functions/execute-flow/index.ts`
- Na função `callAI` (linha 392-407): se `LOVABLE_API_KEY` não existir, buscar `google_ai_api_key` da tabela `system_settings` e usar `callGoogleAI` diretamente
- Na função `autoTagConversation` (linha 332): mesmo fallback
- Mapear os nomes de modelo do formato gateway (`google/gemini-2.5-flash`) para o formato Google API (`gemini-2.5-flash`)

### 5. Alterar `process-follow-ups` para usar Google AI como fallback
- Arquivo: `supabase/functions/process-follow-ups/index.ts`
- Na função `generateAIFollowUp` (linha 121-184): se `LOVABLE_API_KEY` não existir, buscar `google_ai_api_key` de `system_settings` e chamar a API do Google diretamente

### 6. Atualizar modelos disponíveis na UI
- Arquivo: `src/components/chatbot/AgentConfigPanel.tsx` (linhas 674-680)
- Remover modelos OpenAI (não funcionam sem gateway)
- Manter apenas modelos Gemini que funcionam com a API gratuita do Google:
  - `gemini-2.5-flash`
  - `gemini-2.5-pro`
  - `gemini-2.5-flash-lite`

### Arquivos alterados
- `deploy/supabase/init.sql` -- adicionar coluna `config`
- Migration SQL -- garantir coluna no Cloud
- `supabase/functions/execute-flow/index.ts` -- fallback Google AI
- `supabase/functions/process-follow-ups/index.ts` -- fallback Google AI
- `src/components/chatbot/AgentConfigPanel.tsx` -- modelos Gemini apenas
- `src/components/configuracoes/OptionsTab.tsx` -- campo para Google AI API Key

