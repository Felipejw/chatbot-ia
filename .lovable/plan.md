

# Corrigir Follow-up: agendamento + "Processar agora"

## Problemas identificados

### 1. "Processar agora" retorna erro (non-2xx)
A função `process-follow-ups` **não está** no `config.toml` com `verify_jwt = false`. Quando o frontend chama via `supabase.functions.invoke()`, o JWT do usuário autenticado é enviado, mas a verificação pode falhar dependendo do ambiente. Além disso, os CORS headers estão incompletos (faltam headers do SDK como `x-supabase-client-platform`).

### 2. Follow-ups não são agendados no banco
O código em `execute-flow` (linhas 1828-1845 e 2033-2051) só agenda se `cfg.followUpIntervalMinutes > 0`. Mas a UI salva a configuração granular em `followUpStepConfigs` (array com intervalo por etapa). Se `followUpIntervalMinutes` ficar como 0 ou undefined, o agendamento é silenciosamente ignorado. Além disso, o insert **não passa** os campos granulares (`step_intervals`, `allowed_hours_start/end`, `allowed_days`, `follow_up_model`, `follow_up_temperature`, `stop_on_human_assign`, `closing_message`), então mesmo quando agenda, os follow-ups ficam sem a config completa.

## Solução

### A. Configurar JWT e CORS para `process-follow-ups`
- Adicionar `[functions.process-follow-ups] verify_jwt = false` no `config.toml` (a função já usa `SUPABASE_SERVICE_ROLE_KEY` internamente)
- Atualizar CORS headers para incluir headers do SDK do Supabase

### B. Corrigir agendamento no `execute-flow`
- Calcular o intervalo da primeira etapa a partir de `followUpStepConfigs[0]` quando `followUpIntervalMinutes` estiver ausente/zero
- Passar todos os campos granulares no insert: `step_intervals`, `allowed_hours_start`, `allowed_hours_end`, `allowed_days`, `follow_up_model`, `follow_up_temperature`, `stop_on_human_assign`, `closing_message`
- Aplicar nos dois pontos de agendamento (linha ~1828 e ~2033)

### C. Melhorar feedback de erro no frontend
- Mostrar mensagem de erro detalhada no toast quando "Processar agora" falhar

## Arquivos
- `supabase/functions/process-follow-ups/index.ts` — CORS headers
- `supabase/functions/execute-flow/index.ts` — lógica de agendamento (2 pontos)
- `supabase/config.toml` — NÃO editar (gerenciado automaticamente), usar deploy config

