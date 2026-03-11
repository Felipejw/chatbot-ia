

# Simplificar campos técnicos da tab IA para leigos

## Mudanças em `src/components/chatbot/AgentConfigPanel.tsx`

### 1. Temperatura → "Nível de Criatividade"
- Renomear label para **"Criatividade das respostas"**
- Trocar o slider por 3 opções visuais (cards clicáveis) ao invés de um número decimal:
  - **Preciso** (0.3) — "Respostas objetivas e consistentes"
  - **Equilibrado** (0.6) — "Mistura de precisão e naturalidade"
  - **Criativo** (0.9) — "Respostas mais humanas e variadas"
- Manter o slider abaixo como opção avançada colapsável ("Ajuste fino") para quem quiser controle manual

### 2. Máximo de tokens → "Tamanho das respostas"
- Renomear label para **"Tamanho máximo das respostas"**
- Trocar o input numérico por 3 opções visuais:
  - **Curta** (250) — "Respostas diretas, 1-2 frases"
  - **Média** (500) — "Respostas completas, 3-5 frases"
  - **Longa** (1000) — "Respostas detalhadas e explicativas"
- Opção "Personalizado" que exibe o input numérico caso o usuário queira controle total

### 3. Prompt do sistema → Área expandida
- Aumentar o `rows` do Textarea de 5 para **12**
- Adicionar botão **"Expandir"** que abre um Dialog/modal com o Textarea em tela quase cheia (mais confortável para prompts longos)
- Adicionar contador de caracteres no canto inferior direito
- Placeholder mais orientador: "Descreva como a IA deve se comportar, o tom de voz, regras específicas..."

### Arquivo alterado
- `src/components/chatbot/AgentConfigPanel.tsx` — apenas refatoração visual dos 3 campos acima

