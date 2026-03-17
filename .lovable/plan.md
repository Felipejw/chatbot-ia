

# Análise Completa e Correção do Disparo em Massa para VPS

## Problema Imediato
O erro **"JSON object requested, multiple (or no) rows returned"** ocorre na linha 177 de `useCampaigns.ts`: o `useUpdateCampaign` usa `.select().single()` após o update. Na VPS, a política RLS de `ALL` para admins pode não reconhecer `auth.uid()`, fazendo o update retornar 0 rows, e `.single()` falha.

## Problemas Encontrados na Análise Geral

### 1. `useUpdateCampaign` — `.single()` + RLS bloqueado
- Usa `supabase.from('campaigns').update(...).select().single()` diretamente
- Precisa migrar para `adminWrite` como fallback

### 2. `useDeleteCampaign` — RLS bloqueado
- Usa `supabase.from('campaigns').delete()` diretamente
- Precisa migrar para `adminWrite`

### 3. `handleSave` faz 2 updates separados
- O primeiro via `useUpdateCampaign` (que usa `.single()` — falha)
- O segundo via `supabase.from("campaigns").update({...}).eq("id", campaignId)` direto — também pode falhar por RLS
- Solução: unificar num único `adminWrite` com todos os campos

### 4. `useAddContactsToCampaign` — RLS bloqueado
- `campaign_contacts` tem política ALL só para admin/manager
- Usa `supabase.from('campaign_contacts').insert()` direto
- Precisa migrar para `adminWrite`

### 5. `handleStartCampaign` — status update via `useUpdateCampaign`
- Mesmo problema do item 1

### 6. Interface `Campaign` desatualizada
- Falta campos: `replied_count`, `warmup_enabled`, `warmup_daily_increment`, `long_pause_every`, `long_pause_minutes`, `shuffle_contacts`
- Causa os `(campaign as any).warmup_enabled` no ConfigPanel

### 7. `CampaignContact` interface sem `replied_at`
- Status não inclui `'replied'`

## Plano de Mudanças

| Arquivo | Mudança |
|---|---|
| `src/hooks/useCampaigns.ts` | Migrar `useUpdateCampaign`, `useDeleteCampaign`, `useAddContactsToCampaign` para `adminWrite`. Atualizar interfaces `Campaign` e `CampaignContact` com campos faltantes. |
| `src/components/campanhas/CampaignConfigPanel.tsx` | Unificar `handleSave` num único `adminWrite` update com todos os campos (eliminar o segundo update direto). Remover casts `as any` dos campos agora tipados. |
| DB Migration | Adicionar políticas INSERT para `campaign_contacts` (autenticados) e UPDATE para `campaigns` (autenticados), similar ao padrão já usado em contacts/conversations. |

### Detalhes Técnicos

**SQL Migration:**
```sql
CREATE POLICY "Authenticated users can update campaigns" 
  ON public.campaigns FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete campaigns" 
  ON public.campaigns FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert campaign contacts" 
  ON public.campaign_contacts FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update campaign contacts" 
  ON public.campaign_contacts FOR UPDATE 
  USING (auth.uid() IS NOT NULL);
```

**useUpdateCampaign** → usa `adminWrite({ table: 'campaigns', operation: 'update', data: input, filters: { id } })`

**handleSave** → um único `adminWrite` update com todos os campos juntos (mensagem + config + anti-ban)

**useDeleteCampaign** → usa `adminWrite({ table: 'campaigns', operation: 'delete', filters: { id } })`

**useAddContactsToCampaign** → usa `adminWrite({ table: 'campaign_contacts', operation: 'insert', data: inserts })`

