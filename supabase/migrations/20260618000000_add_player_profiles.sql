create table if not exists public.player_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null,
  coins integer not null default 0 check (coins >= 0),
  solved_words integer not null default 0 check (solved_words >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.player_profiles enable row level security;

create policy "read own player profile"
  on public.player_profiles for select
  using (auth.uid() = user_id);

create policy "insert own player profile"
  on public.player_profiles for insert
  with check (auth.uid() = user_id);

create policy "update own player profile"
  on public.player_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
