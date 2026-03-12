

# Plano: Adicionar capacidades suportadas por cada modelo na seleção

## O que será feito

Adicionar badges/descrições ao lado de cada modelo no seletor mostrando quais tipos de mídia ele suporta (texto, áudio, imagens, documentos). Isso ajuda o usuário a escolher o modelo certo sabendo qual aceita áudio, por exemplo.

## Alterações

**`src/components/chatbot/AgentConfigPanel.tsx`** (linhas 680-691)

Substituir os `SelectItem` simples por itens com descrições de capacidades:

```text
Gemini 2.5 Flash (Recomendado)     📝 💬 🎧 📄 🖼️
  Texto, Áudio, Documentos, Imagens

Gemini 2.5 Pro                     📝 💬 🎧 📄 🖼️
  Texto, Áudio, Documentos, Imagens — Mais preciso

Gemini 2.5 Flash Lite (Rápido)     📝 💬
  Apenas texto — Mais rápido e econômico

GPT-4o Mini (Econômico)            📝 💬 🖼️
  Texto e Imagens

GPT-4o (Mais capaz)                📝 💬 🎧 🖼️
  Texto, Áudio e Imagens

GPT-4 Turbo (Rápido)               📝 💬 🖼️
  Texto e Imagens
```

Cada item terá:
- Nome do modelo (texto principal)
- Linha secundária em texto menor mostrando as capacidades suportadas com ícones de badge (usando componente `Badge` existente)
- Badges coloridos: verde para "Áudio", azul para "Imagens", cinza para "Documentos"

A implementação usará `SelectItem` customizado com layout de duas linhas (nome + capabilities) para manter a UX limpa dentro do dropdown.

## Arquivos alterados
- `src/components/chatbot/AgentConfigPanel.tsx` — modelo selector com capabilities

