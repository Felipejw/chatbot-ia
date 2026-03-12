

# Diagnóstico: "Não foi possível carregar suas permissões" após reinstalação

## Causa raiz

No script `deploy/scripts/install.sh`, quando o admin é criado via API (caminho principal, linhas 1077-1095), o script faz apenas um **UPDATE** na tabela `user_roles`:

```bash
UPDATE user_roles SET role = 'admin' WHERE user_id = '$USER_ID';
```

Porém, o trigger `handle_new_user` (que cria automaticamente a row em `user_roles` e `profiles`) **não é criado** quando `init.sql` roda, porque `auth.users` ainda não existe nesse momento (o GoTrue cria a tabela depois). O bloco `EXCEPTION WHEN undefined_table` captura o erro silenciosamente.

Resultado: quando o admin é criado via API, não existe row em `user_roles` para atualizar. O UPDATE afeta 0 linhas. O usuário fica sem role. O `AuthContext` lê `role = null` e o `ProtectedRoute` mostra a tela de erro.

O caminho SQL fallback (linhas 1100-1143) **não tem esse bug** — ele usa `INSERT ... WHERE NOT EXISTS`. Mas esse caminho só roda quando a API não está disponível.

## Solução

### 1. Corrigir `deploy/scripts/install.sh` (caminho API, linhas 1088-1095)

Substituir o `UPDATE` por `INSERT ... ON CONFLICT` para `user_roles` E `profiles`:

```sql
INSERT INTO user_roles (user_id, role) VALUES ('$USER_ID', 'admin')
ON CONFLICT (user_id, role) DO UPDATE SET role = 'admin';

INSERT INTO profiles (user_id, name, email) VALUES ('$USER_ID', '$ADMIN_NAME', '$ADMIN_EMAIL')
ON CONFLICT (user_id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email;
```

### 2. Corrigir `deploy/scripts/install-unified.sh` (mesmo problema)

Aplicar a mesma correção se existir o mesmo padrão.

### 3. Solução imediata para o VPS atual

Rodar manualmente na VPS:
```bash
sudo docker compose exec -T db psql -U postgres -d postgres -c "
  INSERT INTO user_roles (user_id, role)
  SELECT id, 'admin' FROM auth.users WHERE email = 'admin@admin.com'
  ON CONFLICT (user_id, role) DO UPDATE SET role = 'admin';
  
  INSERT INTO profiles (user_id, name, email)
  SELECT id, 'Administrador', 'admin@admin.com' FROM auth.users WHERE email = 'admin@admin.com'
  ON CONFLICT (user_id) DO UPDATE SET name = 'Administrador';
"
```

## Arquivos a editar
- `deploy/scripts/install.sh` — linhas 1088-1095: trocar UPDATE por INSERT ON CONFLICT + adicionar insert de profile

