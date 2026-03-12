

# Diagnóstico: IA não responde — "Configure a chave da API"

## Causa raiz

A chave de API do Google (Gemini) **não está salva** na tabela `system_settings`. Consultei o banco e a tabela está vazia para `google_ai_api_key`.

O fluxo no `execute-flow` é:
1. Tenta gateway Lovable → não existe na VPS
2. Fallback: busca `google_ai_api_key` no banco → não encontra
3. Retorna a mensagem de erro que você viu

## Possíveis causas

A chave pode nunca ter sido salva, ou o salvamento falhou silenciosamente na VPS. Vou verificar e corrigir os dois lados:

### 1. Melhorar o path config-based no `execute-flow`
- Passar `useOwnApiKey: true` para agentes config-based com modelo Gemini, garantindo que busca a chave do DB prioritariamente
- Adicionar logs mais detalhados para diagnóstico

### 2. Garantir que o salvamento da chave funciona na VPS
- O `safeSettingUpsert` tenta 3 métodos (edge function → admin-write → client direto). Se todos falharem, o erro pode não estar aparecendo claramente
- Adicionar feedback visual mais claro na UI quando a chave é salva/falha

### 3. Mostrar aviso no AgentConfigPanel quando a chave não está configurada
- Ao selecionar um modelo Gemini, verificar se `google_ai_api_key` existe no `system_settings`
- Ao selecionar um modelo GPT, verificar se `openai_api_key` existe
- Se não existir, mostrar um alerta com link direto para Configurações > Opções

## Arquivos alterados
- `supabase/functions/execute-flow/index.ts` — corrigir passagem de `useOwnApiKey` e melhorar logs
- `src/components/chatbot/AgentConfigPanel.tsx` — aviso visual quando API key não configurada

