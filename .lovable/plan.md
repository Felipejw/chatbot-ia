

# Atualizar URLs do GitHub nos scripts de instalação

Preciso trocar todas as referências de `Felipejw/comms-nect-ai` para `Felipejw/chatbot-ia` em 3 arquivos:

### Arquivos a alterar

1. **`deploy/scripts/bootstrap.sh`** (3 ocorrências)
   - Linha 9: comentário de uso
   - Linha 24: `REPO_URL`

2. **`deploy/baileys/scripts/bootstrap.sh`** (2 ocorrências)
   - Linha 35: mensagem de uso
   - Linha 88: `REPO_URL`

3. **`deploy/baileys/README.md`** (2 ocorrências)
   - Linhas 10 e 51: exemplos de comando

### Resultado

Após a alteração, o comando de instalação será:
```bash
curl -fsSL https://raw.githubusercontent.com/Felipejw/chatbot-ia/main/deploy/scripts/bootstrap.sh | sudo bash
```

**Importante**: Para que este comando funcione, você precisa primeiro conectar o projeto ao GitHub (Settings > GitHub > Connect) e vincular ao repositório `Felipejw/chatbot-ia`. Assim o código será sincronizado automaticamente e o `curl` conseguirá baixar o script.

