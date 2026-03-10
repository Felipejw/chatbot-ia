

# Melhorias e Ajustes

## 1. Sidebar — Menu plano sem submenus

**Arquivo:** `src/components/layout/AppSidebar.tsx`

Remover o sistema de seções colapsáveis (section titles com chevron). Todos os itens de navegação ficam listados em sequência, um abaixo do outro, sem agrupamento nem botão de expandir/recolher seção.

- Flatten `navSections` em um array simples de `NavItem[]`
- Remover `expandedSections`, `toggleSection`, e os headers de seção do render
- Remover imports `ChevronDown`, `ChevronRight`
- Manter collapse/expand do sidebar inteiro (ícone `ChevronsLeft`/`ChevronsRight`)

## 2. Remover "Botões da Mensagem" do Disparo em Massa

**Arquivo:** `src/components/campanhas/CampaignDialog.tsx`

- Remover o bloco de UI "Botões da Mensagem" (linhas ~564-601)
- Remover estados `useButtons`, `buttons` e funções `addButton`, `removeButton`, `updateButton`
- Remover `use_buttons` e `buttons` do payload em `handleCreateCampaign`
- Limpar `resetForm` dos campos removidos

## Arquivos alterados
- `src/components/layout/AppSidebar.tsx`
- `src/components/campanhas/CampaignDialog.tsx`

