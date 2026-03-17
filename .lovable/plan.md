

# Refatorar Disparo em Massa com layout Sidebar + Painel de Configuração

## Objetivo
Transformar a página de Campanhas para usar o mesmo layout do Agente de IA: uma sidebar à esquerda listando as campanhas (com busca, filtro e botão "Novo") e um painel de configuração à direita com abas para editar a campanha selecionada.

## Layout Final

```text
┌──────────────┬──────────────────────────────────────┐
│  SIDEBAR     │  PAINEL DE CONFIGURAÇÃO              │
│  (264px)     │                                      │
│              │  [Mensagem] [Mídia] [Contatos] [Config]│
│  🔍 Buscar   │                                      │
│  + Novo      │  Nome: Promoção Verão                │
│              │  Descrição: ...                       │
│  ● Campanha1 │  Mensagem: Olá {{nome}}...           │
│  ○ Campanha2 │  Variações: ...                      │
│  ○ Campanha3 │                                      │
│              │  [Salvar] [Iniciar Disparo]           │
│              │                                      │
└──────────────┴──────────────────────────────────────┘
```

## Componentes Novos/Alterados

| Arquivo | Mudança |
|---|---|
| `src/components/campanhas/CampaignSidebar.tsx` | **Novo** — Sidebar com lista de campanhas, busca, filtro por status, botão novo, toggle ativo/pausado, excluir. Baseado no `FlowSidebar.tsx` |
| `src/components/campanhas/CampaignConfigPanel.tsx` | **Novo** — Painel de configuração com abas (Mensagem, Mídia, Contatos, Configurações, Métricas). Converte o conteúdo do `CampaignDialog` de modal para painel inline, similar ao `AgentConfigPanel` |
| `src/pages/Campanhas.tsx` | **Reescrever** — Layout `flex h-full` com sidebar + painel, sem os cards de grid. O `CampaignDialog` deixa de ser usado como modal de criação; agora a criação acontece na sidebar (cria campanha mínima) e a configuração no painel |

## Detalhes Técnicos

1. **CampaignSidebar**: 
   - Reutiliza o padrão do `FlowSidebar` (collapsed/expanded, busca, lista com hover actions)
   - Cada item mostra nome, status badge (Rascunho/Ativa/Pausada/Concluída), e contadores (enviadas/total)
   - Ações hover: play/pause, excluir
   - Botão "Novo" cria campanha em rascunho com nome padrão e seleciona

2. **CampaignConfigPanel**:
   - Abas: **Mensagem** (nome, descrição, template, texto, variações), **Mídia** (tipo, URL), **Contatos** (seleção por lista/colar/CSV, filtro por tags), **Segurança** (intervalos, risco), **Métricas** (dashboard da campanha selecionada)
   - Botão "Salvar" (salva alterações) e "Iniciar Disparo" (muda status para active)
   - Edição inline como o AgentConfigPanel — sem modal

3. **Hooks existentes** (`useCampaigns`, `useUpdateCampaign`, etc.) continuam sendo usados sem alteração

4. O `CampaignDialog.tsx` será mantido no código por enquanto mas não mais usado na página principal — toda a funcionalidade migra para o painel

