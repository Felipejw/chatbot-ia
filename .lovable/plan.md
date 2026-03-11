

# Corrigir e melhorar o Dashboard

## Problemas identificados

1. **Warning de ref no console**: `StatsCard` e `EmptyState` recebem refs mas não usam `forwardRef` — causa warnings no console
2. **Gráfico ocupa apenas metade da tela**: O `ActivityChart` está dentro de `grid-cols-2` mas é o unico item, ficando em 50% da largura
3. **Falta segundo widget no grid do gráfico**: O layout prevê 2 colunas mas só tem 1 componente — podemos adicionar um card de "Performance da Equipe" ou expandir o gráfico para largura total
4. **Skeleton count inconsistente**: Loading mostra 4 skeletons mas existem 5 StatsCards

## Plano de correção

### 1. Corrigir warnings de ref
- **`src/components/dashboard/StatsCard.tsx`**: Envolver com `React.forwardRef`
- **`src/components/ui/EmptyState.tsx`**: Envolver com `React.forwardRef`

### 2. Expandir gráfico para largura total
- **`src/pages/Dashboard.tsx`**: Mudar o grid do gráfico de `lg:grid-cols-2` para largura total (`col-span-full` ou remover o grid), já que só tem 1 componente

### 3. Corrigir skeleton count
- **`src/pages/Dashboard.tsx`**: Mudar `length: 4` para `length: 5` no loading state

### 4. Adicionar card de Performance da Equipe
- Criar **`src/components/dashboard/TeamPerformance.tsx`** — widget que mostra os atendentes com mais conversas resolvidas e ativas, usando o hook `useTeamPerformance` que já existe
- Colocar no grid ao lado do `ActivityChart`, restaurando o layout 2 colunas

### Arquivos alterados
- `src/components/dashboard/StatsCard.tsx` — forwardRef
- `src/components/ui/EmptyState.tsx` — forwardRef
- `src/pages/Dashboard.tsx` — fix skeleton count, adicionar TeamPerformance
- `src/components/dashboard/TeamPerformance.tsx` — novo componente

