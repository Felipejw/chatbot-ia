

# Widget de Conversas por Canal + Tags Automáticas via IA

## 1. Widget de Gráfico de Pizza — Conversas por Canal

### Novo arquivo: `src/components/dashboard/ChannelChart.tsx`
- Query a tabela `conversations` agrupando pelo campo `channel` (já existe, default `'whatsapp'`)
- Usar `PieChart` + `Pie` + `Cell` do Recharts (já instalado)
- Cores distintas por canal (WhatsApp = verde, outros = cores temáticas)
- Mostrar legenda com contagem e percentual
- Skeleton loading enquanto carrega

### Alteração: `src/pages/Dashboard.tsx`
- Adicionar uma terceira linha no layout com o `ChannelChart` + `RecentConversations` lado a lado em grid 2 colunas
- Ou colocar o `ChannelChart` numa nova row acima das conversas recentes

Layout proposto:
```text
┌─────────────────────────────────────────────────┐
│  Stats Cards (5 colunas)                        │
├────────────────────┬────────────────────────────┤
│  Atividade Semanal │  Performance da Equipe     │
├────────────────────┼────────────────────────────┤
│  Conversas por     │  Conversas Recentes        │
│  Canal (pizza)     │                            │
└────────────────────┴────────────────────────────┘
```

---

## 2. Tags Automáticas via IA nas Conversas

A ideia: quando a IA do chatbot responde uma conversa, ela analisa o conteúdo e aplica automaticamente tags relevantes (ex: "Dúvida", "Reclamação", "Venda", "Suporte Técnico").

### Como funciona
- No edge function `execute-flow` (que processa as respostas da IA), após gerar a resposta, fazer uma segunda chamada rápida à IA pedindo para classificar a conversa em categorias
- A IA retorna as tags aplicáveis, e o backend insere na tabela `conversation_tags` automaticamente
- Usa as tags já cadastradas na tabela `tags` — a IA escolhe entre as existentes

### Alteração: `supabase/functions/execute-flow/index.ts`
- Após gerar a resposta do chatbot, adicionar um passo opcional de classificação:
  1. Buscar as tags existentes no banco (`SELECT id, name, description FROM tags`)
  2. Enviar ao modelo uma instrução: "Classifique esta conversa nas seguintes categorias: [lista de tags]. Retorne apenas os nomes aplicáveis em JSON."
  3. Fazer match dos nomes retornados com os IDs das tags
  4. Inserir em `conversation_tags` (com `ON CONFLICT DO NOTHING` para evitar duplicatas)
- Adicionar um system setting `auto_tag_enabled` (default `true`) para poder desativar

### Migração de banco
- Adicionar unique constraint em `conversation_tags` para `(conversation_id, tag_id)` se não existir (para suportar `ON CONFLICT`)

### Arquivos alterados
- `src/components/dashboard/ChannelChart.tsx` — novo
- `src/pages/Dashboard.tsx` — adicionar ChannelChart ao layout
- `supabase/functions/execute-flow/index.ts` — adicionar auto-tagging após resposta da IA

