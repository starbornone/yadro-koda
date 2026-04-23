import { createClient } from '@supabase/supabase-js';

const getRequiredEnv = (name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_PUBLISHABLE_KEY'): string => {
  const value = import.meta.env[name];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

const supabaseUrl = getRequiredEnv('VITE_SUPABASE_URL');
const supabasePublishableKey = getRequiredEnv('VITE_SUPABASE_PUBLISHABLE_KEY');

export const supabase = createClient(supabaseUrl, supabasePublishableKey);
