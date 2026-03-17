

# Fix: Follow-up System Not Sending Messages

## Root Cause

Two problems identified:

1. **`process-follow-ups` is NOT registered in either router** (`main/index.ts` for Cloud, `index.ts` for VPS). The cron job on Cloud calls the function directly (works), but the "Processar agora" button uses `supabase.functions.invoke()` which goes through the router → gets 404 → shows the error in the screenshot.

2. **On VPS, `process-follow-ups` is also missing from the VPS router** (`index.ts`), so even the cron job on VPS fails when routing through the main entry point.

The metrics showing "Respondidos: 4, Enviados: 0" is actually correct — the contacts replied before follow-ups were due, so they went from `pending` → `replied` directly (the webhook in `baileys-webhook` handles this). But since no follow-ups were ever actually sent (the function can't execute properly), "Enviados" stays at 0.

## Changes

| File | Change |
|---|---|
| `supabase/functions/main/index.ts` | Add `'process-follow-ups'` to `VALID_FUNCTIONS` set |
| `supabase/functions/index.ts` | Add `'process-follow-ups'` to `VALID_FUNCTIONS` set |
| Redeploy `process-follow-ups` | Ensure the edge function is deployed and accessible |

Both routers need the entry so the function can be called from:
- The "Processar agora" button (via `supabase.functions.invoke`)
- The VPS cron job (via the main router)

This is a 2-line fix across 2 files.

