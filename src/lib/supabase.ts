import { createClient } from "@supabase/supabase-js";

// A chave publicável pode ficar no código: ela só dá o acesso que as
// regras de segurança (RLS) do banco permitem. Cada pessoa logada
// enxerga e altera apenas os próprios lançamentos.
const url = import.meta.env.VITE_SUPABASE_URL || "https://vygrnacbfnhtgxieqxgn.supabase.co";
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_7c3x6jqW4SFyoNNyMe1lQA_qrotloqX";

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
