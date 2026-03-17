

# Diagnóstico: Follow-up só envia ao clicar "Processar agora"

## O que está acontecendo

O cron job **está funcionando corretamente** — os logs mostram que `process-follow-ups` executa a cada minuto. Porém, ele encontra **0 follow-ups pendentes** porque os follow-ups criados antes da correção de intervalo tinham `scheduled_at` configurado para **60 minutos** no futuro (o bug que acabamos de corrigir).

O fluxo é:
1. Contato envia mensagem → `execute-flow` cria follow-up com `scheduled_at = now + 60min` (bug antigo)
2. Cron roda a cada minuto → verifica `scheduled_at <= now()` → encontra 0 (ainda não chegou a hora)
3. Usuário clica "Processar agora" depois de ~60min → agora `scheduled_at` já passou → processa

## A correção já foi aplicada

A mudança de prioridade no `execute-flow/index.ts` (`firstStepInterval || cfg.followUpIntervalMinutes || 60`) já foi feita. **Novos** follow-ups serão agendados com o intervalo correto (2 minutos).

## O que falta

Nenhuma mudança de código é necessária. O sistema já está corrigido. O usuário precisa:

1. **Testar com uma nova conversa** — enviar uma mensagem para o agente e aguardar 2 minutos
2. Os follow-ups antigos (criados com o bug de 60min) já foram processados ou cancelados

**Não há mudanças de código a implementar.** A correção anterior já resolve este problema para novos follow-ups.

