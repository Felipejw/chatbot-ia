

# Plano: Delay aleatório + Script de atualização simplificado

## 1. Delay aleatório entre dois períodos

Atualmente o `responseDelay` é um valor fixo (0, 3, 5, 10s). Vou adicionar uma opção "Aleatório" que permite definir um intervalo (ex: entre 3 e 8 segundos). Cada resposta usará um delay randômico nesse range, simulando comportamento humano.

### Alterações

**`src/components/chatbot/AgentConfigPanel.tsx`**
- Adicionar campos `responseDelayMode` (`fixed` | `random`) e `responseDelayMax` ao `AgentConfig`
- Na UI, adicionar botão "Aleatório" ao lado dos presets existentes
- Quando selecionado, exibir dois inputs: "De X seg" e "Até Y seg"

**`supabase/functions/execute-flow/index.ts`**
- Na linha 1554, onde já aplica `responseDelay`, verificar `cfg.responseDelayMode`:
  - Se `"random"`: gerar delay entre `cfg.responseDelay` (mín) e `cfg.responseDelayMax` (máx)
  - Se `"fixed"` ou ausente: manter comportamento atual

---

## 2. Comando de atualização one-line (sem reinstalar)

O `deploy/scripts/update.sh` já existe e faz: git pull → rebuild frontend → deploy → migrations → restart containers. Mas ele assume que o repositório já foi clonado. Vou criar um **script de atualização remota** que pode ser executado via `curl`, similar ao bootstrap mas **preservando** .env, sessões e banco.

### Alteração

**`deploy/scripts/update-remote.sh`** (novo arquivo)
- Comando: `curl -fsSL https://raw.githubusercontent.com/Felipejw/chatbot-ia/main/deploy/scripts/update-remote.sh | sudo bash`
- Fluxo:
  1. Detectar instalação existente em `/opt/sistema`
  2. Fazer backup do `.env` e sessões
  3. Git fetch + reset (ou re-clone se necessário)
  4. Executar o `update.sh` existente (que faz build, deploy, migrations, restart)
  5. Restaurar configs
- Não reinstala Docker, banco ou Supabase — só atualiza código e frontend

### Arquivos alterados
- `src/components/chatbot/AgentConfigPanel.tsx` — modo aleatório no delay
- `supabase/functions/execute-flow/index.ts` — random delay no edge function
- `deploy/scripts/update-remote.sh` — novo script de atualização via curl

