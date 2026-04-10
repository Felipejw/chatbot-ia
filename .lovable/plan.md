
Objetivo: corrigir os 3 pontos de forma integrada para o ambiente web e para a VPS.

O que a análise mostrou

1. Desativar agente de IA
- O status `is_active` é salvo, mas o comportamento não para de forma confiável.
- O toggle da sidebar invalida apenas a lista (`chatbot-flows`) e não o registro aberto (`chatbot-flow`, id), então a UI pode ficar inconsistente.
- Mais importante: a função que executa o agente continua retomando conversas com `flow_state` mesmo que o agente tenha sido desativado depois. Ou seja: desativar não corta a execução já em andamento.

2. Follow-up só parou ao pausar o disparo
- O processador de follow-up roda de forma independente a cada minuto:
  - no app, via `useFollowUpPoller`
  - na VPS, via cron `process-follow-ups`
- Hoje não existe vínculo real entre follow-up e status da campanha. Então um follow-up pode continuar mesmo com a campanha já devendo estar “parada”.
- O sistema também não cancela follow-ups pendentes quando a campanha é pausada/concluída.

3. Disparo em massa não funciona
- A função de processamento existe (`execute-campaign`), mas não há nenhum agendador chamando ela.
- A VPS hoje agenda apenas `process-follow-ups`, não `execute-campaign`.
- Não encontrei nenhum poller no frontend nem cron/script chamando `execute-campaign`, e não há logs recentes dela rodando.
- Além disso, o `flow_id` da campanha está salvo na configuração, mas o executor da campanha não usa esse agente para assumir a conversa quando houver resposta.
- O `send-whatsapp` hoje força `is_bot_active = false`, o que quebra a passagem para o agente depois do disparo.

Plano de correção

1. Fazer o botão de ativar/desativar agente funcionar de verdade
- Ajustar `src/hooks/useFlows.ts` para invalidar:
  - `["chatbot-flows"]`
  - `["chatbot-flow", id]`
- Ajustar `src/components/chatbot/AgentConfigPanel.tsx` para usar o mesmo fluxo de atualização e manter UI e backend sincronizados.
- Ajustar `supabase/functions/execute-flow/index.ts` para:
  - ao retomar uma conversa com `flow_state`, verificar se o agente ainda está ativo
  - se estiver inativo, limpar `flow_state`, `active_flow_id`, desligar bot na conversa e impedir novas respostas automáticas
- Ajustar `supabase/functions/baileys-webhook/index.ts` para não disparar o executor do agente quando a conversa estiver apontando para um agente inativo.

2. Fazer o disparo em massa realmente processar
- Criar um poller de campanhas no frontend, no mesmo padrão do follow-up:
  - novo `src/hooks/useCampaignPoller.ts`
  - integrar em `src/components/layout/AppLayout.tsx`
- Na VPS, agendar também a execução de `execute-campaign` a cada minuto:
  - atualizar `deploy/scripts/setup-cron.sh` ou separar em um setup de jobs
  - garantir chamada automática no fluxo de update remoto
- Adicionar logs melhores em `supabase/functions/execute-campaign/index.ts` para diagnosticar campanha ativa, contatos pendentes, conexão escolhida e motivo de skip.

3. Ligar corretamente campanha, conversa, agente e follow-up
- O executor da campanha deve usar o `flow_id` da campanha quando existir.
- Ao criar/reutilizar a conversa do contato, salvar contexto da campanha para que a resposta do contato volte para o agente certo.
- Para isso, vou adicionar vínculo de campanha no banco:
  - `conversations.campaign_id`
  - `follow_ups.campaign_id`
- Assim o fluxo fica:
```text
campanha ativa
  -> execute-campaign envia mensagem
  -> conversa fica vinculada à campanha e ao agente escolhido
  -> contato responde
  -> webhook chama execute-flow
  -> execute-flow agenda follow-up vinculado à mesma campanha
  -> process-follow-ups só envia se a campanha ainda estiver ativa
```

4. Impedir que follow-up continue quando a campanha parar
- Ajustar `supabase/functions/execute-flow/index.ts` para gravar `campaign_id` nos follow-ups gerados a partir de conversa de campanha.
- Ajustar `supabase/functions/process-follow-ups/index.ts` para:
  - consultar a campanha vinculada
  - não enviar follow-up se a campanha estiver `paused` ou `completed`
  - cancelar esses follow-ups automaticamente
- Ajustar a pausa/conclusão da campanha para cancelar follow-ups pendentes ligados à campanha.
- Isso separa o comportamento:
  - follow-up normal de atendimento continua funcionando
  - follow-up vindo de campanha respeita o status da campanha

5. Não deixar o envio da campanha desligar o bot por engano
- Ajustar `supabase/functions/send-whatsapp/index.ts` para suportar um modo “preservar estado do bot” quando o envio vier do disparo.
- Alternativa equivalente: tratar o envio da campanha sem zerar `is_bot_active`.
- Isso é necessário para que, após o disparo, a resposta do contato possa cair no agente escolhido.

6. Compatibilidade VPS
- Como haverá novo vínculo de campanha, vou sincronizar isso também nos scripts de instalação:
  - migration do app
  - `deploy/supabase/init.sql`
  - migration incremental em `deploy/supabase/migrations/...`
- Também vou garantir que o update da VPS configure os dois jobs automáticos:
  - `process-follow-ups`
  - `execute-campaign`

Arquivos previstos
- `src/hooks/useFlows.ts`
- `src/components/chatbot/AgentConfigPanel.tsx`
- `src/hooks/useCampaignPoller.ts` novo
- `src/components/layout/AppLayout.tsx`
- `src/hooks/useCampaigns.ts` se precisar expor melhor estados/ações
- `supabase/functions/execute-flow/index.ts`
- `supabase/functions/execute-campaign/index.ts`
- `supabase/functions/process-follow-ups/index.ts`
- `supabase/functions/send-whatsapp/index.ts`
- `supabase/functions/baileys-webhook/index.ts`
- migration do banco para `campaign_id`
- `deploy/supabase/init.sql`
- `deploy/supabase/migrations/...`
- `deploy/scripts/setup-cron.sh`
- possivelmente `deploy/scripts/update-remote.sh`

Validação final que vou fazer após implementar
1. Desativar um agente e confirmar que ele para de responder em conversa já existente.
2. Criar campanha, salvar, adicionar contatos e iniciar.
3. Confirmar que `execute-campaign` está rodando automaticamente.
4. Confirmar que a campanha envia mensagens.
5. Responder como contato e validar que o agente configurado assume.
6. Confirmar que follow-up é criado só quando aplicável.
7. Pausar a campanha e validar que follow-ups ligados a ela são cancelados.
8. Testar isso end-to-end também na VPS.

Detalhes técnicos
- O problema principal não é só UI; é de orquestração:
  - o agente não respeita desativação em runtime
  - o follow-up não respeita campanha
  - o disparo não tem scheduler
- Corrigir apenas a tela não resolve. A correção precisa unir:
  - frontend
  - funções backend
  - migration
  - scripts de VPS

Se você aprovar, eu implemento esse pacote completo de correção.
