

# Transcrição de áudio para IA + Correção do Follow-Up

## ✅ Concluído

### 1. Transcrição de áudio via Gemini
- **`baileys-webhook`**: Agora passa `messageType` e `mediaUrl` ao `execute-flow`
- **`execute-flow`**: Nova função `transcribeAudio()` que:
  1. Baixa o áudio do storage
  2. Converte para base64
  3. Envia ao Gemini como input multimodal para transcrição
  4. Fallback para Lovable AI Gateway
  5. Se falhar, usa "[O contato enviou um áudio que não pôde ser transcrito]"

### 2. Correção do Follow-Up na VPS
- **`process-follow-ups`**: Logs detalhados (total pending, URL do Supabase)
- **`deploy/scripts/setup-cron.sh`** (novo): Configura pg_cron na VPS apontando para a URL local
- **`update-remote.sh`**: Agora chama `setup-cron.sh` automaticamente após deploy

### 3. Correção: IA ignora prompt atualizado
- **RESUME path**: Agora relê `chatbot_flows.config` em vez de usar cache do `flow_state`
- Qualquer edição no prompt aplica imediatamente em conversas ativas

### 4. Prevenção de problemas recorrentes
- **`test-agent`** (nova edge function): Testa agente sem WhatsApp, mostra diagnósticos
- **`AgentConfigPanel`**: Botão "Testar" abre mini-chat com diagnóstico de config
- **`execute-flow` RESUME**: Fetch duplicado consolidado (1 query em vez de 3), logs de diagnóstico
- **Routers**: `test-agent` registrado em `main/index.ts` e `index.ts`
