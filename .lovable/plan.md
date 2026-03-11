

# Reorganizar configuração do Agente de IA em blocos visuais

## Problema atual
A configuração usa Accordion (lista vertical de seções colapsáveis), o que dificulta a navegação e a localização rápida das seções.

## Solução
Substituir o layout de accordion por um sistema de **blocos/cards com navegação por abas laterais ou tabs no topo**. Cada bloco será um card independente visível ao clicar na tab correspondente, semelhante a um painel de configurações moderno.

### Layout proposto

```text
┌─────────────────────────────────────────────┐
│  Header: Nome do Agente + Botão Salvar      │
├──────┬──────────────────────────────────────│
│ Tabs │  Conteúdo do bloco selecionado       │
│      │                                       │
│ ⚙ Geral       │  [Card com campos]          │
│ ⚡ Gatilho     │                              │
│ 🧠 IA         │                              │
│ 💬 WhatsApp   │                              │
│ ↔ Transfer.   │                              │
│ 🔄 Follow-up  │                              │
│ ✕ Encerram.   │                              │
└──────┴──────────────────────────────────────┘
```

### Implementação

Usar `Tabs` do Radix (já instalado) com orientação vertical no desktop e horizontal no mobile:

- **Tabs à esquerda** (sidebar interna) com ícone + label para cada seção
- **Conteúdo à direita** renderiza apenas o bloco ativo, sem scroll infinito
- Cada tab tem um **indicador visual** (dot colorido ou borda) mostrando se há configuração ativa naquela seção (ex: IA habilitada, follow-up ativo)
- Badge de status na tab (ex: "Ativo" verde no Follow-up quando habilitado)

### Alterações

**`src/components/chatbot/AgentConfigPanel.tsx`** — Único arquivo alterado:
- Substituir `<Accordion>` por `<Tabs>` com `orientation="vertical"`
- Mover cada seção (Geral, Gatilho, IA, WhatsApp, Transferência, Follow-up, Encerramento) para um `<TabsContent>`
- Adicionar `<TabsList>` como sidebar lateral com ícones + labels
- Cada card de conteúdo mantém exatamente os mesmos campos e lógica
- No mobile (< 768px), tabs ficam horizontais no topo com scroll
- Manter toda a lógica de estado, save, updateConfig intacta

