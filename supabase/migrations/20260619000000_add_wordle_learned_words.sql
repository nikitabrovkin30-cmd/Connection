-- Общий словарь Wordle: сюда попадают слова, которые ИИ уже подтвердил как существующие.
-- Читать могут все игроки, добавлять может только вошедший пользователь/анонимная сессия.

create table if not exists public.wordle_learned_words (
  word text not null,
  length smallint not null check (length in (4, 5, 6)),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (word, length)
);

alter table public.wordle_learned_words enable row level security;

create policy "read learned wordle words"
  on public.wordle_learned_words for select
  using (true);

create policy "insert learned wordle words"
  on public.wordle_learned_words for insert
  with check (auth.uid() = created_by);
