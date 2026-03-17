

# Ajustes no Disparo em Massa

## Mudanças

### 1. Limite diário até 30.000
No `CampaignConfigPanel.tsx` linha 683, o slider atual tem `max={1000}`. Alterar para `max={30000}` e ajustar o `step` para 100 para facilitar a navegação.

### 2. Horário 24h
Adicionar um checkbox/switch "Enviar 24 horas" acima dos campos de horário. Quando ativado, seta `allowedHoursStart = "00:00"` e `allowedHoursEnd = "23:59"` e esconde os inputs de horário.

### 3. Variações — Confirmação
Sim, as variações estão funcionando corretamente de forma randômica. No `execute-campaign/index.ts` linhas 228-232, o código junta a mensagem principal + variações num array e escolhe aleatoriamente com `Math.floor(Math.random() * allMessages.length)`. Nenhuma alteração necessária.

### 4. Duplicar campanha na sidebar
Adicionar botão "Duplicar" no hover de cada item da sidebar (`CampaignSidebar.tsx`). Ao clicar, cria uma nova campanha copiando todos os campos da original (nome + " (cópia)", mensagem, variações, configs) e seleciona a nova.

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/components/campanhas/CampaignConfigPanel.tsx` | Slider max=30000, step=100. Switch "24 horas" no horário |
| `src/components/campanhas/CampaignSidebar.tsx` | Botão duplicar com ícone Copy no hover de cada campanha |

