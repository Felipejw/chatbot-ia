// Runtime-aware Supabase client wrapper
// Reads window.__SUPABASE_CONFIG__ (injected by config.js on VPS)
// with fallback to Vite env vars (for Lovable preview / dev)

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

const runtimeConfig = (window as any).__SUPABASE_CONFIG__;

const SUPABASE_URL = runtimeConfig?.url || import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = runtimeConfig?.anonKey || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
