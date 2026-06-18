import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  throw new Error(
    'Нет ключей Supabase. Скопируй .env.example в .env.local и добавь VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY.',
  );
}

export const supabase = createClient(url, anonKey);
