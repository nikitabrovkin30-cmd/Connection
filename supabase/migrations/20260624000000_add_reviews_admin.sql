alter table public.player_profiles
  add column if not exists is_admin boolean not null default false;

update public.player_profiles
set is_admin = true,
    updated_at = now()
where lower(nickname) = lower('Nikita Brovkin');

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  author_email text,
  body text not null check (char_length(trim(body)) between 3 and 1000),
  created_at timestamptz not null default now()
);

alter table public.reviews enable row level security;

drop policy if exists "insert reviews" on public.reviews;
create policy "insert reviews"
  on public.reviews for insert
  with check (user_id is null or auth.uid() = user_id);

drop policy if exists "read own reviews" on public.reviews;
create policy "read own reviews"
  on public.reviews for select
  using (auth.uid() = user_id);

drop policy if exists "admin read reviews" on public.reviews;
create policy "admin read reviews"
  on public.reviews for select
  using (
    exists (
      select 1
      from public.player_profiles
      where player_profiles.user_id = auth.uid()
        and player_profiles.is_admin = true
    )
  );
