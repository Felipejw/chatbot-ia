

# Fix: Follow-up ignora intervalo configurado nas etapas (sempre usa 60 min)

## Diagnóstico

Analisei os logs e o código em detalhe. O follow-up **está sendo criado** (Pendentes: 1 na tela), mas **não é enviado** no tempo configurado (2 minutos).

### Causa raiz

No `execute-flow/index.ts`, ao calcular o intervalo do follow-up, a prioridade está invertida:

```typescript
// BUG — linha 1963, 2193
let intervalMinutes = cfg.followUpIntervalMinutes || firstStepInterval || 60;
```

`cfg.followUpIntervalMinutes` tem valor padrão **60** (definido no AgentConfigPanel linha 224). Como `60` é truthy, ele **sempre vence** o `firstStepInterval` (que seria 2, do stepConfig configurado na UI). Resultado: o follow-up é agendado para 60 minutos no futuro, não 2.

## Correção

Inverter a prioridade em **3 ocorrências** no `execute-flow/index.ts`:

```typescript
// ANTES
let intervalMinutes = cfg.followUpIntervalMinutes || firstStepInterval || 60;

// DEPOIS
let intervalMinutes = firstStepInterval || cfg.followUpIntervalMinutes || 60;
```

Isso garante que o intervalo da etapa 1 (configurado na UI) tenha prioridade sobre o campo legado.

| Arquivo | Mudança |
|---|---|
| `supabase/functions/execute-flow/index.ts` | Inverter prioridade em 3 pontos: linhas ~1963, ~2193, e path de resume (~1959 se existir) |

Após deploy, o follow-up de 2 minutos será respeitado corretamente.

