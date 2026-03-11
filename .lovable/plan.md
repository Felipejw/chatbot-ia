

# Redesign Completo do Sistema

## Paleta de Cores

Baseado nas preferências: azul claro, azul marinho e verde WhatsApp.

```text
Azul Marinho (sidebar/dark):  #0A1628 → #0F2240
Azul Claro (primary):         #2B7FFF → #5BA3FF  
Verde WhatsApp (accent):      #25D366 → #128C7E
Background:                   #F0F4F8 (light) / #0B1120 (dark)
Cards:                        #FFFFFF (light) / #111B2E (dark)
```

## Alterações

### 1. `src/index.css` — Nova paleta completa
- **Light mode**: fundo azul-gelo (`#F0F4F8`), cards brancos, primary azul vibrante `#2B7FFF`, accent verde WhatsApp `#25D366`
- **Dark mode**: fundo navy profundo `#0B1120`, cards `#111B2E`, primary azul claro `#5BA3FF`, accent verde `#2EE67A`
- **Sidebar**: gradiente navy `#0A1628` → `#0F2240`, accent com glow sutil
- **Chat bubbles**: incoming cinza-azulado, outgoing verde WhatsApp suave
- Adicionar glass-morphism nos cards (backdrop-blur + semi-transparência)
- Border radius mais generoso (1rem)
- Novas animações: slide-up para cards, fade-scale para modais

### 2. `src/components/layout/AppSidebar.tsx` — Sidebar moderna
- Gradiente vertical no fundo
- Links com indicador lateral colorido (barra à esquerda) no ativo, em vez de fundo sólido
- Hover com glow suave verde/azul
- Logo com glow sutil
- Separadores visuais entre seções
- Avatar com ring colorido de status

### 3. `src/components/layout/AppLayout.tsx` — Layout refinado
- Fundo com pattern sutil (dots ou grid muito leve)
- Header mobile com gradiente

### 4. `src/pages/Dashboard.tsx` + `StatsCard.tsx` — Cards modernos
- Stats cards com gradiente sutil no ícone, borda esquerda colorida
- Hover com elevação + sombra colorida
- Números com transição animada

### 5. `src/pages/Login.tsx` — Tela de login premium
- Lado esquerdo com gradiente navy → azul, pattern decorativo
- Glassmorphism no card de login
- Botão com gradiente azul → verde

### 6. `tailwind.config.ts` — Novas utilidades
- Adicionar cores de gradiente
- Box-shadow com cores customizadas

### 7. `src/components/ui/PageHeader.tsx` — Header com gradiente no ícone

### 8. `src/components/ui/badge.tsx` — Badges com cores mais vibrantes

## Arquivos alterados
- `src/index.css` (paleta + animações + componentes)
- `tailwind.config.ts` (novas utilidades)
- `src/components/layout/AppSidebar.tsx` (visual)
- `src/components/layout/AppLayout.tsx` (layout)
- `src/pages/Dashboard.tsx` (cards)
- `src/components/dashboard/StatsCard.tsx` (design)
- `src/components/dashboard/ActivityChart.tsx` (cores)
- `src/components/dashboard/RecentConversations.tsx` (visual)
- `src/pages/Login.tsx` (redesign)
- `src/components/ui/PageHeader.tsx` (gradiente)
- `src/components/ui/SkeletonCard.tsx` (visual)

