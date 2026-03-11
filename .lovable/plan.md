

# Página /follow-up com Dashboard de Métricas + Suporte a Mídia nos Follow-ups

## 1. Nova página `/follow-up` com dashboard de métricas

Criar `src/pages/FollowUp.tsx` com:

### Cards de métricas (topo)
- **Total enviados** — count de follow_ups com status `sent`
- **Respondidos** — count com status `replied`
- **Taxa de resposta** — respondidos / enviados em %
- **Cancelados** — count com status `cancelled`
- **Pendentes** — count com status `pending`

### Gráfico de barras (recharts)
- Follow-ups enviados vs respondidos nos últimos 7 dias, agrupados por dia

### Ranking de efetividade por agente
- Tabela com: nome do agente (flow), total enviados, respondidos, taxa de resposta, ordenado por efetividade
- Busca dados via join `follow_ups.flow_id → chatbot_flows.name`

### Hook `useFollowUpMetrics.ts`
- Queries para buscar os dados agregados diretamente do banco (counts por status, agrupamento por dia, agrupamento por flow_id)

## 2. Suporte a mídia nas mensagens fixas de follow-up

### Alterações no `AgentConfigPanel.tsx`
Na seção de cada etapa com `mode === "fixed"`, adicionar:
- **Select de tipo de mídia**: nenhuma, imagem, áudio, vídeo
- **Input de URL da mídia** ou **botão de upload** (usa `useFileUpload` existente)
- Preview da mídia selecionada

### Alterações na interface `FollowUpStep`
```typescript
interface FollowUpStep {
  interval: number;
  unit: "minutes" | "hours" | "days";
  message: string;
  mode: "ai" | "fixed";
  mediaUrl?: string;
  mediaType?: "none" | "image" | "audio" | "video";
}
```

### Alterações no `process-follow-ups/index.ts`
- Nova função `sendWhatsAppMedia` que envia mídia via Baileys endpoint `/send/media`
- Na hora de enviar mensagem fixa, verificar se tem `mediaUrl` e chamar o endpoint correto
- Salvar `media_url` e `message_type` no insert de `messages`

### Migração SQL
- Adicionar coluna `media_url TEXT` e `media_type TEXT DEFAULT 'none'` na tabela `follow_ups` (para registro do que foi enviado)

## 3. Rota e navegação

- Adicionar rota `/follow-up` no `App.tsx` (lazy load)
- Adicionar item "Follow-up" na sidebar (`AppSidebar.tsx`) com ícone `RotateCcw`

## Arquivos

- **Novo**: `src/pages/FollowUp.tsx`
- **Novo**: `src/hooks/useFollowUpMetrics.ts`
- **Editado**: `src/App.tsx` (rota)
- **Editado**: `src/components/layout/AppSidebar.tsx` (nav item)
- **Editado**: `src/components/chatbot/AgentConfigPanel.tsx` (mídia por etapa)
- **Editado**: `supabase/functions/process-follow-ups/index.ts` (envio de mídia)
- **1 migração SQL** (media_url, media_type na follow_ups)

