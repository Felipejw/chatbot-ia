

# Refatoração: Foco em Chatbot de IA

## Resumo

Remover telas e funcionalidades não relacionadas ao foco de IA/Chatbot, limpar referências à Evolution API, e garantir login padrão com `admin@admin.com` / `123456`.

## 1. Remover telas e páginas

**Páginas a excluir (arquivos):**
- `src/pages/Painel.tsx`
- `src/pages/Relatorios.tsx`
- `src/pages/RespostasRapidas.tsx`
- `src/pages/Contatos.tsx`
- `src/pages/ChatInterno.tsx`
- `src/pages/Usuarios.tsx`

**Hooks associados a remover:**
- `src/hooks/usePanelStats.ts`
- `src/hooks/useReportStats.ts`
- `src/hooks/useQuickReplies.ts`
- `src/hooks/useContacts.ts`
- `src/hooks/useChatInterno.ts`
- `src/hooks/useUsers.ts`
- `src/hooks/useContactProfile.ts`
- `src/hooks/useContactDisplayName.ts`
- `src/hooks/useContactOnlineStatus.ts`
- `src/hooks/useSyncContacts.ts`

**Componentes associados a remover:**
- `src/components/usuarios/PermissionsModal.tsx`
- `src/components/usuarios/PermissionsPanel.tsx`
- `src/components/dashboard/TeamPerformance.tsx` (se referencia Atendentes)

## 2. Atualizar App.tsx

Remover imports e rotas para: Painel, Relatorios, RespostasRapidas, Contatos, ChatInterno, Usuarios.

## 3. Atualizar Sidebar (AppSidebar.tsx)

Remover itens de navegação:
- Seção "Gerência": remover "Relatórios" e "Painel"
- Seção "Atendimento": remover "Respostas Rápidas", "Contatos" e "Chat Interno"
- Seção "Administração": remover "Atendentes"

## 4. Atualizar módulos de permissões (usePermissions.ts)

Remover dos arrays `MODULES` e `ROUTE_TO_MODULE` as entradas: `relatorios`, `painel`, `respostas_rapidas`, `contatos`, `chat_interno`, `usuarios`.

## 5. Remover referências Evolution API

A busca no código fonte (excluindo `deploy/`) não encontrou referências diretas à "Evolution API" ou "EVOLUTION_API". As referências de WhatsApp usam **Baileys**, não Evolution. Os secrets `EVOLUTION_API_KEY` e `EVOLUTION_API_URL` existem no ambiente mas não são usados no código. Nenhuma alteração de código necessária aqui -- apenas remover os secrets do ambiente.

## 6. Login padrão admin@admin.com / 123456

O login já foi resetado via `bootstrap-admin` em iteração anterior. O formulário de login em `Login.tsx` já funciona corretamente. Nenhuma alteração necessária.

## Arquivos alterados
- `src/App.tsx` -- remover rotas
- `src/components/layout/AppSidebar.tsx` -- remover itens do menu
- `src/hooks/usePermissions.ts` -- remover módulos
- Deletar ~16 arquivos de páginas, hooks e componentes não mais necessários

