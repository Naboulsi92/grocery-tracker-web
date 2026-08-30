import { createBrowserClient } from '@supabase/ssr';

const globalForSupabase = globalThis as unknown as {
  supabase: ReturnType<typeof createBrowserClient> | undefined;
};

let client = globalForSupabase.supabase;

export function createClient() {
  if (client) return client;
  
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  globalForSupabase.supabase = client;
  
  return client;
}