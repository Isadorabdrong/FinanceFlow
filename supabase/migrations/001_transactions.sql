-- Tabela de lançamentos. Cada linha pertence a um usuário (auth.users).
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  description text not null check (char_length(trim(description)) between 2 and 140),
  amount_cents bigint not null check (amount_cents > 0 and amount_cents <= 99999999999),
  type text not null check (type in ('income', 'expense')),
  category text not null check (char_length(category) between 1 and 40),
  date date not null check (date between '1900-01-01' and '2100-12-31'),
  created_at timestamptz not null default now()
);

create index transactions_user_date_idx on public.transactions (user_id, date desc);

-- RLS: ninguém é administrador. Cada pessoa só lê e altera o que é dela.
alter table public.transactions enable row level security;

create policy "ver os próprios lançamentos" on public.transactions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "criar os próprios lançamentos" on public.transactions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "editar os próprios lançamentos" on public.transactions
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "excluir os próprios lançamentos" on public.transactions
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.transactions from anon;
grant select, insert, update, delete on public.transactions to authenticated;
