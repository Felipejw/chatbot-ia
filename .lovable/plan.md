

# Corrigir: Update travado + Login com "Internal server error"

## Problemas identificados

### 1. Script travado em "Verificando migrations..."
O script `update.sh` (linha 165) faz `$DOCKER_COMPOSE up -d db` e depois entra em um loop `while` esperando `pg_isready`. Como o `init.sql` foi modificado para incluir a tabela `follow_ups`, se o banco já existia, o init.sql **não roda novamente** (Docker só executa init scripts em volumes vazios). O travamento provavelmente ocorre porque o container `db` não está subindo sozinho sem suas dependências, ou o pg_isready nunca retorna OK no tempo esperado.

### 2. "Internal server error" no login
Como o script travou antes de chegar à etapa 6 (linha 199-201: `$DOCKER_COMPOSE --profile baileys up -d --force-recreate`), os containers de auth/kong/rest foram parados mas **nunca reiniciados**. O GoTrue (auth) está down, causando o erro no login.

### 3. backup.sh com "Permission denied"
O script `backup.sh` não tem permissão de execução. Embora o update continue mesmo assim, gera confusão.

## Solução imediata (manual na VPS)

O usuário precisa rodar na VPS agora para restaurar os serviços:
```bash
cd /opt/sistema/deploy
docker compose --profile baileys up -d
```

## Correções no código para evitar recorrência

### A. `deploy/scripts/update.sh`
1. **Linha 151**: Adicionar `chmod +x` no `backup.sh` antes de executar
2. **Linhas 164-178**: Melhorar robustez da espera do banco - adicionar timeout mais curto e continuar mesmo se falhar
3. **Mover o restart dos containers (etapa 6) para ANTES das migrations** - assim os serviços voltam primeiro, e as migrations rodam depois com tudo no ar

### B. `deploy/scripts/update-remote.sh`
Adicionar `chmod +x` nos scripts antes de executar, e garantir que o init.sql com follow_ups seja aplicado como patch SQL avulso via `docker exec`.

## Arquivos a editar
- `deploy/scripts/update.sh` — reordenar etapas + chmod + robustez
- `deploy/scripts/update-remote.sh` — adicionar patch SQL automático para follow_ups

