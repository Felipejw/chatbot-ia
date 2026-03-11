

# Melhorar o visual do painel de configuração do Agente de IA

O painel atual está funcional, mas visualmente "seco" — labels pequenos, sem hierarquia visual clara, sem cores de destaque, e sem espaçamento generoso. Vamos dar vida a ele.

## Melhorias planejadas

### 1. Tabs laterais mais expressivas
- Ícones maiores com cores temáticas por seção (IA = roxo, WhatsApp = verde, Follow-up = azul, etc.)
- Tab ativa com fundo gradiente sutil + borda lateral colorida (como a sidebar do sistema)
- Descrição curta abaixo do nome de cada tab (ex: "Gatilho" → "Quando o agente ativa")
- StatusDot maior e com animação pulse quando ativo

### 2. Header de cada seção dentro do conteúdo
- Cada `TabsContent` ganha um header com ícone grande + título + descrição da seção em texto muted
- Separador visual (divider) entre o header e os campos

### 3. Cards de campo agrupados
- Inputs agrupados em cards com `bg-card` e bordas suaves, ao invés de ficarem "soltos"
- Labels com tamanho maior (`text-sm font-medium`) e com ícone inline quando aplicável
- Descriptions sob cada campo em texto `text-xs text-muted-foreground` para orientar o usuário

### 4. Cores e badges de status
- Switch "Agente ativo" com badge verde/vermelho ao lado
- Seções desabilitadas (IA off, Transfer off) com overlay sutil em vez de sumir completamente
- Badge "Ciclo total: 1d2h30min" no Follow-up com cor de destaque
- Timeline do Follow-up com cores mais vibrantes e linhas mais grossas

### 5. Espaçamento e tipografia
- Padding `p-8` no conteúdo (ao invés de `p-6`)
- Gaps maiores entre campos (`space-y-6` ao invés de `space-y-4`)
- Títulos de seção em `text-xl font-semibold`
- Cards de etapa do Follow-up com borda esquerda colorida (numbered steps)

### 6. Animações sutis
- Transição `animate-fade-in` ao trocar de tab
- Cards de etapa com hover suave (`hover:shadow-md transition-shadow`)

## Arquivo alterado
- **`src/components/chatbot/AgentConfigPanel.tsx`** — refatoração visual completa (mesmo conteúdo/lógica, apenas styling)

