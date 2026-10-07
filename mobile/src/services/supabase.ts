import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://lxucntgxipmpjjdlkgmi.supabase.co';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4dWNudGd4aXBtcGpqZGxrZ21pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NjI3NDUsImV4cCI6MjEwNjQzODc0NX0.sfUhdV1FdfVyuQuADnVm_QWeYvMpARES3rD3VYCi1Qw';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
