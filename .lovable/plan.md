

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

### Próximos passos do usuário
1. Salvar a chave do Google AI em Configurações > Opções
2. Rodar `update-remote.sh` na VPS para aplicar as mudanças
3. O cron job será configurado automaticamente
