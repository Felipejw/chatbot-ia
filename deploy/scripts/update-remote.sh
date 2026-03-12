#!/bin/bash

# ============================================
# Atualização Remota - Sistema de Atendimento
# Uso: curl -fsSL https://raw.githubusercontent.com/Felipejw/chatbot-ia/main/deploy/scripts/update-remote.sh | sudo bash
# ============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[AVISO]${NC} $1"; }
log_error() { echo -e "${RED}[ERRO]${NC} $1"; }

# Verificar root
if [ "$EUID" -ne 0 ]; then
    log_error "Execute como root: curl ... | sudo bash"
    exit 1
fi

echo -e "${CYAN}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║   ATUALIZAÇÃO REMOTA - Sistema de Atendimento             ║"
echo "║   Data: $(date)                                           "
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ==========================================
# 1. Detectar instalação existente
# ==========================================
PROJECT_DIR=""
REPO_URL="https://github.com/Felipejw/chatbot-ia.git"

for dir in /opt/sistema /opt/chatbot-ia /root/chatbot-ia /root/sistema; do
    if [ -d "$dir/deploy" ]; then
        PROJECT_DIR="$dir"
        break
    fi
done

if [ -z "$PROJECT_DIR" ]; then
    log_error "Instalação não encontrada em /opt/sistema, /opt/chatbot-ia, /root/chatbot-ia ou /root/sistema"
    log_info "Execute o instalador primeiro: curl -fsSL .../bootstrap.sh | sudo bash"
    exit 1
fi

log_success "Instalação encontrada em: $PROJECT_DIR"
DEPLOY_DIR="$PROJECT_DIR/deploy"

cd "$PROJECT_DIR"

# ==========================================
# 2. Preservar configurações
# ==========================================
log_info "Preservando configurações..."

# Backup do .env
if [ -f "$DEPLOY_DIR/.env" ]; then
    cp "$DEPLOY_DIR/.env" /tmp/.env.update.bak
    log_success ".env preservado"
fi

# Backup do config.js (frontend runtime config)
if [ -f "$DEPLOY_DIR/frontend/dist/config.js" ]; then
    cp "$DEPLOY_DIR/frontend/dist/config.js" /tmp/config.js.update.bak
    log_success "config.js preservado"
fi

# Backup do kong.yml
if [ -f "$DEPLOY_DIR/volumes/kong/kong.yml" ]; then
    cp "$DEPLOY_DIR/volumes/kong/kong.yml" /tmp/kong.yml.update.bak
    log_success "kong.yml preservado"
fi

# ==========================================
# 3. Atualizar código via Git
# ==========================================
log_info "Atualizando código..."

# Detectar usuário dono do diretório
OWNER=$(stat -c '%U' "$PROJECT_DIR" 2>/dev/null || echo "root")

if [ -d "$PROJECT_DIR/.git" ]; then
    # Repositório git existe — fazer fetch + reset
    cd "$PROJECT_DIR"
    
    # Tentar git pull primeiro
    if su -c "cd $PROJECT_DIR && git pull origin main" "$OWNER" 2>/dev/null; then
        log_success "Git pull OK"
    else
        # Fallback: reset hard
        log_warning "Git pull falhou, fazendo reset..."
        su -c "cd $PROJECT_DIR && git fetch origin main && git reset --hard origin/main" "$OWNER" 2>/dev/null || {
            # Último recurso: re-clone
            log_warning "Git reset falhou, re-clonando..."
            TEMP_DIR=$(mktemp -d)
            git clone --depth 1 "$REPO_URL" "$TEMP_DIR"
            
            # Copiar arquivos novos preservando volumes e sessões
            rsync -a --exclude='deploy/volumes' \
                     --exclude='deploy/backups' \
                     --exclude='deploy/.env' \
                     --exclude='deploy/frontend/dist/config.js' \
                     --exclude='.git' \
                     --exclude='node_modules' \
                     "$TEMP_DIR/" "$PROJECT_DIR/"
            
            rm -rf "$TEMP_DIR"
            log_success "Re-clone concluído"
        }
    fi
else
    # Sem .git — clonar fresh e copiar
    log_info "Diretório sem .git, clonando repositório..."
    TEMP_DIR=$(mktemp -d)
    git clone --depth 1 "$REPO_URL" "$TEMP_DIR"
    
    rsync -a --exclude='deploy/volumes' \
             --exclude='deploy/backups' \
             --exclude='deploy/.env' \
             --exclude='deploy/frontend/dist/config.js' \
             --exclude='node_modules' \
             "$TEMP_DIR/" "$PROJECT_DIR/"
    
    rm -rf "$TEMP_DIR"
    log_success "Código atualizado"
fi

# ==========================================
# 4. Restaurar configurações
# ==========================================
log_info "Restaurando configurações..."

if [ -f /tmp/.env.update.bak ]; then
    cp /tmp/.env.update.bak "$DEPLOY_DIR/.env"
    rm -f /tmp/.env.update.bak
    log_success ".env restaurado"
fi

if [ -f /tmp/kong.yml.update.bak ]; then
    mkdir -p "$DEPLOY_DIR/volumes/kong"
    cp /tmp/kong.yml.update.bak "$DEPLOY_DIR/volumes/kong/kong.yml"
    rm -f /tmp/kong.yml.update.bak
    log_success "kong.yml restaurado"
fi

# ==========================================
# 5. Executar update.sh existente
# ==========================================
log_info "Executando atualização completa..."

cd "$PROJECT_DIR"

if [ -f "$DEPLOY_DIR/scripts/update.sh" ]; then
    chmod +x "$DEPLOY_DIR/scripts/update.sh"
    bash "$DEPLOY_DIR/scripts/update.sh"
else
    log_error "Script update.sh não encontrado em $DEPLOY_DIR/scripts/"
    exit 1
fi

# ==========================================
# 6. Restaurar config.js após build
# ==========================================
if [ -f /tmp/config.js.update.bak ]; then
    cp /tmp/config.js.update.bak "$DEPLOY_DIR/frontend/dist/config.js"
    rm -f /tmp/config.js.update.bak
    log_success "config.js restaurado após build"
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Atualização Remota Concluída!                           ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  Para futuras atualizações, use o mesmo comando:"
echo "  curl -fsSL https://raw.githubusercontent.com/Felipejw/chatbot-ia/main/deploy/scripts/update-remote.sh | sudo bash"
echo ""
