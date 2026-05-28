import { createClient } from '@supabase/supabase-js';

// Migrated 2026-05-28: Finance moved from its own Supabase project into
// Agency OS as schema `finance`. Same client URL/key as the main app,
// just scoped to the finance schema via `db.schema`.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

export const financeSupabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'finance' },
});
