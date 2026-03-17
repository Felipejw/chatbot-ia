

# Preview da Mensagem e Resumo antes de Iniciar o Disparo

## Mudanças

### Nova aba "Revisão" (ou substituir o botão "Iniciar" por um fluxo de revisão)

Adicionar uma **6ª aba "Revisão"** no TabsList que mostra um resumo completo antes de iniciar o disparo:

**Conteúdo da aba Revisão:**
1. **Preview da mensagem** com variáveis substituídas (`{{nome}}`, `{{telefone}}`) usando dados de um contato exemplo da lista
2. Se houver variações ativas, mostrar 2-3 exemplos aleatórios de como as mensagens ficariam
3. Se houver mídia, mostrar thumbnail/nome do arquivo
4. **Resumo da configuração:**
   - Total de contatos selecionados
   - Conexão de envio escolhida
   - Intervalo entre mensagens
   - Limite diário / Horário permitido
   - Aquecimento ativo? Shuffle? Pausas longas?
   - Nível de risco (badge colorido)
5. **Tempo estimado** de conclusão baseado no intervalo médio × quantidade de contatos
6. **Botão "Iniciar Disparo"** no final da revisão (em vez de ficar no header)

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/components/campanhas/CampaignConfigPanel.tsx` | Adicionar aba "Revisão" com grid-cols-6, conteúdo de preview com substituição de variáveis, resumo de configs, tempo estimado, e botão de início |

