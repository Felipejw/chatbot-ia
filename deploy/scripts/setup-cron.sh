#!/bin/bash

# ============================================
# Configuração dos Cron Jobs
# 1. process-follow-ups - a cada minuto
# 2. execute-campaign - a cada minuto
# ============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[AVISO]${NC} $1"; }
log_error() { echo -e "${RED}[ERRO]${NC} $1"; }

# Detectar diretório do deploy
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"

# Carregar .env
if [ -f "$DEPLOY_DIR/.env" ]; then
    source "$DEPLOY_DIR/.env"
else
    log_error ".env não encontrado em $DEPLOY_DIR/.env"
    exit 1
fi

# Variáveis necessárias
# Use internal Docker URL for pg_cron (avoids external DNS/TLS issues)
INTERNAL_URL="http://kong:8000"
SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"

if [ -z "$SERVICE_ROLE_KEY" ]; then
    log_error "SERVICE_ROLE_KEY não definida no .env"
    exit 1
fi

if [ -z "$POSTGRES_PASSWORD" ]; then
    log_error "POSTGRES_PASSWORD não definida no .env"
    exit 1
fi

log_info "Configurando cron jobs..."
log_info "URL interna: ${INTERNAL_URL}/functions/v1/..."

# SQL para criar/atualizar os cron jobs
CRON_SQL="
-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remover jobs anteriores se existirem
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname IN ('process-follow-ups', 'execute-campaign');

-- Job 1: process-follow-ups a cada minuto
SELECT cron.schedule(
  'process-follow-ups',
  '* * * * *',
  \$\$
  SELECT net.http_post(
    url := '${INTERNAL_URL}/functions/v1/process-follow-ups',
    headers := '{\"Content-Type\": \"application/json\", \"Authorization\": \"Bearer ${SERVICE_ROLE_KEY}\"}'::jsonb,
    body := concat('{\"time\": \"', now(), '\"}')::jsonb
  ) AS request_id;
  \$\$
);

-- Job 2: execute-campaign a cada minuto
SELECT cron.schedule(
  'execute-campaign',
  '* * * * *',
  \$\$
  SELECT net.http_post(
    url := '${INTERNAL_URL}/functions/v1/execute-campaign',
    headers := '{\"Content-Type\": \"application/json\", \"Authorization\": \"Bearer ${SERVICE_ROLE_KEY}\"}'::jsonb,
    body := concat('{\"time\": \"', now(), '\"}')::jsonb
  ) AS request_id;
  \$\$
);
"

# Executar via psql no container
CONTAINER_NAME=$(docker ps --format '{{.Names}}' | grep -E 'supabase-db|postgres' | head -1)

if [ -z "$CONTAINER_NAME" ]; then
    log_warning "Container do PostgreSQL não encontrado, tentando via host..."
    PGPASSWORD="$POSTGRES_PASSWORD" psql -h localhost -p "$POSTGRES_PORT" -U supabase_admin -d postgres -c "$CRON_SQL" 2>/dev/null || {
        log_error "Não foi possível conectar ao PostgreSQL"
        exit 1
    }
else
    docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$CONTAINER_NAME" \
        psql -U supabase_admin -d postgres -c "$CRON_SQL" 2>/dev/null || {
        log_error "Erro ao executar SQL no container $CONTAINER_NAME"
        exit 1
    }
fi

log_success "Cron job 'process-follow-ups' configurado (a cada minuto)"
log_success "Cron job 'execute-campaign' configurado (a cada minuto)"
log_info "URL: ${INTERNAL_URL}/functions/v1/... (rede interna Docker)"
