

# Plano: Corrigir página Follow-up que fica carregando infinitamente

## Problema

A página de Follow-up fica presa no spinner de loading porque o hook `useFollowUpMetrics` usa 3 queries independentes com `react-query`. Se qualquer uma dessas queries falhar (ex: tabela não existe na VPS, erro de RLS, etc.), o `react-query` fica tentando novamente infinitamente, mantendo `isLoading: true` para sempre.

O `isLoading` retorna `true` enquanto QUALQUER das 3 queries estiver carregando ou re-tentando:
```typescript
isLoading: statusCounts.isLoading || dailyVolume.isLoading || agentEffectiveness.isLoading
```

## Solução

### 1. Adicionar tratamento de erro no hook `useFollowUpMetrics`

- Adicionar `retry: 1` (máximo 1 retry) em cada query para não ficar tentando infinitamente
- Retornar também o estado de `error` para que a página possa exibir uma mensagem
- Retornar valores padrão quando houver erro (em vez de `undefined`)

### 2. Melhorar a página `FollowUp.tsx`

- Tratar estado de erro: mostrar a página com valores zerados + mensagem de aviso, em vez de ficar no spinner
- Usar `isError` para exibir um alerta informativo

## Arquivos alterados
- `src/hooks/useFollowUpMetrics.ts` -- adicionar `retry: 1` nas queries, expor `isError`
- `src/pages/FollowUp.tsx` -- tratar erro mostrando página vazia com aviso em vez de spinner infinito

