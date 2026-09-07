import { createClient } from '@supabase/supabase-js';

const useLiveServices = !import.meta.env.DEV
  || import.meta.env.VITE_ALLOW_LIVE_SERVICES_IN_DEV === 'true';

const supabaseUrl = !useLiveServices
  ? import.meta.env.VITE_DEV_SUPABASE_URL || 'http://127.0.0.1:54321'
  : import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = !useLiveServices
  ? import.meta.env.VITE_DEV_SUPABASE_ANON_KEY || 'development-anon-key-not-configured'
  : import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Frontend client with anon key (for auth)
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export default supabaseClient;
