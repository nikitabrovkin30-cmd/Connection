create table if not exists public.association_guesses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  target_word text not null,
  guess_word text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists association_guesses_one_per_user
  on public.association_guesses (user_id, target_word, guess_word);

alter table public.association_guesses enable row level security;

create policy "read own association guesses"
  on public.association_guesses for select
  using (auth.uid() = user_id);

create policy "insert own association guesses"
  on public.association_guesses for insert
  with check (auth.uid() = user_id);

create policy "delete own association guesses"
  on public.association_guesses for delete
  using (auth.uid() = user_id);

create or replace function public.count_association(target text, guess text)
returns integer
language sql
security definer
set search_path = public
as $$
  select count(distinct user_id)::integer
  from public.association_guesses
  where target_word = lower(trim(target))
    and guess_word = lower(trim(guess));
$$;

grant execute on function public.count_association(text, text) to authenticated;
