import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://lxucntgxipmpjjdlkgmi.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4dWNudGd4aXBtcGpqZGxrZ21pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NjI3NDUsImV4cCI6MjEwNjQzODc0NX0.sfUhdV1FdfVyuQuADnVm_QWeYvMpARES3rD3VYCi1Qw';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

// Cliente Supabase principal do backend (utiliza SERVICE_ROLE quando configurado no .env)
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Cria instância temporária associada estritamente ao token JWT do usuário autenticado
export function getAuthenticatedSupabaseClient(token: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

