

# Sistema de Follow-up Integrado com IA

## Conceito

Follow-up automático: quando uma conversa fica sem resposta do contato por X tempo, a IA envia uma mensagem de acompanhamento automaticamente. Configurável por agente, com múltiplas etapas, intervalos personalizados e mensagens geradas pela IA ou predefinidas.

```text
Conversa sem resposta → Tempo passa → IA envia follow-up 1
                         → Mais tempo → IA envia follow-up 2
                         → Mais tempo → IA envia follow-up 3 (último)
                         → Sem resposta → Encerra/Transfere
```

## Alterações

### 1. Migração SQL - Tabela `follow_ups`

Criar tabela para armazenar follow-ups pendentes e executados:

```sql
CREATE TABLE follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  contact_id UUID NOT NULL,
  flow_id UUID,                    -- agente de IA associado
  step INTEGER DEFAULT 1,          -- etapa atual (1, 2, 3...)
  max_steps INTEGER DEFAULT 3,
  interval_minutes INTEGER DEFAULT 60,
  status TEXT DEFAULT 'pending',   -- pending, sent, replied, cancelled
  message_content TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

Com RLS para usuários autenticados e realtime habilitado.

### 2. Adicionar seção "Follow-up" no `AgentConfigPanel.tsx`

Nova seção no accordion entre "Transferência" e "Encerramento":

- **Toggle** habilitar follow-up
- **Número de etapas** (1-5)
- **Intervalo entre etapas** (em minutos/horas)
- **Modo da mensagem**: "IA gera automaticamente" ou "Mensagem fixa"
- **Mensagens fixas** por etapa (se modo fixo)
- **Prompt de follow-up** para IA (se modo IA) - ex: "Gere uma mensagem de acompanhamento amigável"
- **Ação após último follow-up**: encerrar conversa, transferir para fila, ou nada

Campos adicionados ao `AgentConfig`:
```typescript
followUpEnabled: boolean;
followUpSteps: number;
followUpIntervalMinutes: number;
followUpMode: "ai" | "fixed";
followUpMessages: string[];        // mensagens fixas por etapa
followUpPrompt: string;            // prompt para IA gerar
followUpFinalAction: "none" | "close" | "transfer";
```

### 3. Edge Function `process-follow-ups`

Nova edge function que:
1. Busca follow-ups com `status = 'pending'` e `scheduled_at <= now()`
2. Para cada follow-up:
   - Se modo "fixed": usa mensagem da etapa correspondente
   - Se modo "ai": chama Lovable AI Gateway com o prompt de follow-up + contexto da conversa
3. Envia via `send-whatsapp`
4. Se ainda há etapas, cria próximo follow-up agendado
5. Se foi a última etapa, executa ação final (encerrar/transferir)

### 4. Criar follow-ups automaticamente

Modificar o `execute-flow/index.ts` (ou `baileys-webhook`): quando o bot envia uma mensagem e o agente tem follow-up habilitado, criar registro em `follow_ups` com `scheduled_at = now() + intervalo`.

### 5. Cancelar follow-ups quando contato responde

Adicionar lógica no webhook de mensagem recebida: ao receber mensagem do contato, cancelar todos os follow-ups pendentes daquela conversa (`UPDATE follow_ups SET status = 'cancelled'`).

### 6. Hook `useFollowUps.ts`

Hook para visualizar follow-ups na UI do atendimento:
- Listar follow-ups pendentes de uma conversa
- Cancelar manualmente um follow-up
- Ver histórico de follow-ups enviados

### 7. Indicador visual no Atendimento

No painel de chat, mostrar badge/indicador quando há follow-up agendado para aquela conversa, com countdown e opção de cancelar.

---

## Arquivos

- **Novo**: `supabase/functions/process-follow-ups/index.ts`
- **Novo**: `src/hooks/useFollowUps.ts`
- **Editado**: `src/components/chatbot/AgentConfigPanel.tsx` (nova seção)
- **Editado**: `supabase/functions/execute-flow/index.ts` (criar follow-up após envio)
- **Editado**: `supabase/functions/baileys-webhook/index.ts` (cancelar follow-ups ao receber msg)
- **Editado**: `src/pages/Atendimento.tsx` (indicador visual)
- **1 migração SQL** (tabela `follow_ups`)

