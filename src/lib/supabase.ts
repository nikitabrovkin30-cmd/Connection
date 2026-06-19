import { createClient } from '@supabase/supabase-js';

function cleanEnvValue(value: string | undefined) {
  return value?.trim().replace(/^["']|["']$/g, '');
}

function isValidSupabaseUrl(value: string | undefined) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.endsWith('.supabase.co');
  } catch {
    return false;
  }
}

const url = cleanEnvValue(import.meta.env.VITE_SUPABASE_URL as string | undefined);
const anonKey = cleanEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);
const safeUrl = isValidSupabaseUrl(url) && url ? url : 'https://example.supabase.co';
const safeAnonKey = anonKey || 'missing-anon-key';

export const supabaseConfigError =
  !url || !anonKey
    ? 'Нет ключей Supabase. Добавь VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в Vercel Environment Variables.'
    : !isValidSupabaseUrl(url)
      ? 'VITE_SUPABASE_URL должен быть вида https://project-ref.supabase.co без путей после .co.'
      : null;

export const supabase = createClient(safeUrl, safeAnonKey);
