alter table public.association_guesses
  add column if not exists distance integer check (distance >= 2 and distance <= 99);
