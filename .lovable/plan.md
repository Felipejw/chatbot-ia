

# Fix: Erro RLS ao criar campanha na VPS

## Problema
O erro `new row violates row-level security policy for table "campaigns"` ocorre porque a política RLS da tabela `campaigns` exige role `admin/manager` para INSERT (via política ALL). Na VPS, o `auth.uid()` pode não estar sendo reconhecido corretamente pela função `is_admin_or_manager()`.

## Solução
Adicionar uma política RLS específica de INSERT para usuários autenticados na tabela `campaigns`, similar ao padrão usado em outras tabelas do sistema (contacts, conversations, messages). A política ALL existente para admins continuará controlando UPDATE e DELETE.

Também vamos atualizar o `useCreateCampaign` para usar o helper `adminWrite` como fallback (mesmo padrão já usado em outras partes do sistema), garantindo que funcione tanto no Cloud quanto na VPS.

## Mudanças

| Arquivo | Mudança |
|---|---|
| DB Migration | `CREATE POLICY "Authenticated users can create campaigns" ON campaigns FOR INSERT WITH CHECK (auth.uid() IS NOT NULL)` |
| `src/hooks/useCampaigns.ts` | Alterar `useCreateCampaign` para usar `adminWrite` com fallback, igual ao padrão do projeto |

