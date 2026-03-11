

# Perfis de Agente (Templates Pré-configurados)

Adicionar uma seleção opcional de "perfil de agente" na tab de IA que pré-preenche o prompt do sistema, temperatura e modelo com configurações otimizadas para cada caso de uso.

## Perfis disponíveis

| Perfil | Prompt resumido | Temp | Modelo |
|--------|----------------|------|--------|
| **Vendedor (X1)** | Especialista em vendas consultivas, foco em converter leads, tirar dúvidas sobre produto/preço, criar urgência natural | 0.8 | gemini-2.5-flash |
| **Suporte** | Atendente de suporte técnico/SAC, foco em resolver problemas, tom empático e objetivo | 0.5 | gemini-2.5-flash |
| **Agendamento** | Especialista em agendar reuniões/consultas, confirmar horários, enviar lembretes | 0.5 | gemini-2.5-flash-lite |
| **Qualificação de Leads** | Faz perguntas estratégicas para qualificar o lead (BANT), coleta informações antes de transferir | 0.6 | gemini-2.5-flash |
| **Recepcionista** | Primeiro contato, boas-vindas, identifica a necessidade e direciona para o setor correto | 0.7 | gemini-2.5-flash-lite |
| **Personalizado** | Opção atual — o usuário define tudo manualmente (padrão) |

## Implementação

**Arquivo**: `src/components/chatbot/AgentConfigPanel.tsx`

- Adicionar um seletor de perfil (cards visuais com ícone + título + descrição curta) **acima** do campo de modelo na tab IA
- Ao clicar num perfil, preenche automaticamente: `systemPrompt`, `temperature`, `model`
- O perfil "Personalizado" não altera nada (mantém o que o usuário já configurou)
- Após selecionar um perfil, o usuário ainda pode editar qualquer campo livremente
- Armazenar o perfil selecionado num campo local `agentProfile` no config (apenas para UI, não afeta lógica de execução)
- Cada card de perfil terá um ícone temático, cor de fundo sutil, e badge "Recomendado" no Vendedor

Nenhuma mudança no banco de dados — é puramente front-end.

