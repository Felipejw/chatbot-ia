

# Correção: "Failed to fetch" no Login da VPS

## Problema Identificado

O erro "Failed to fetch" ocorre porque o **cliente Supabase está conectando ao URL errado**.

O fluxo atual:
1. O build do frontend é feito com `VITE_SUPABASE_URL=https://placeholder.supabase.co` (variável de compilação)
2. O script gera um `config.js` com `window.__SUPABASE_CONFIG__` contendo a URL correta (`window.location.origin`)
3. **Porém**, o arquivo `client.ts` lê apenas `import.meta.env.VITE_SUPABASE_URL` — que ficou "baked" como `https://placeholder.supabase.co` no momento do build
4. O `window.__SUPABASE_CONFIG__` **nunca é lido** por nenhum código

Resultado: o frontend tenta autenticar contra `https://placeholder.supabase.co`, que não existe → "Failed to fetch".

## Correção

Criar um arquivo `src/lib/supabaseConfig.ts` que lê a configuração runtime (`window.__SUPABASE_CONFIG__`) com fallback para as variáveis de ambiente (para funcionar tanto na VPS quanto no preview do Lovable):

```typescript
// src/lib/supabaseConfig.ts
const runtimeConfig = (window as any).__SUPABASE_CONFIG__;

export const SUPABASE_URL = runtimeConfig?.url || import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = runtimeConfig?.anonKey || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
```

E alterar o `client.ts` para importar deste arquivo em vez de ler diretamente do `import.meta.env`.

**Nota importante**: O `client.ts` é auto-gerado e não pode ser editado diretamente. Então a solução será:
1. Criar `src/lib/supabaseConfig.ts` com a lógica de runtime config
2. Criar um **wrapper** `src/lib/supabase.ts` que exporta o client configurado corretamente
3. Substituir todos os imports de `@/integrations/supabase/client` para usar `@/lib/supabase` — **ou**, mais simples: fazer o wrapper re-exportar de forma transparente

**Abordagem mais simples** (sem alterar dezenas de imports):
- Criar `src/lib/supabaseConfig.ts` 
- Em todos os arquivos que usam `supabase`, o client já é importado de `@/integrations/supabase/client`. Como não podemos editar esse arquivo, vamos criar um **patch**: um arquivo que reconfigura o client na inicialização da app (`main.tsx`), antes de qualquer uso.

Na verdade, a abordagem mais prática:
- Criar `src/lib/supabase.ts` com o client correto usando runtime config
- Fazer busca e substituição em todos os arquivos que importam de `@/integrations/supabase/client`

### Arquivos alterados
- **Criar**: `src/lib/supabase.ts` — client com runtime config + fallback
- **Alterar**: Todos os ~30+ arquivos que importam `@/integrations/supabase/client` → trocar para `@/lib/supabase`

### Nenhuma alteração nos scripts de deploy
Os scripts já geram o `config.js` corretamente. Só faltava o frontend ler ele.

