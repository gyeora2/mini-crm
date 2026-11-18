begin;

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  customer text not null check (char_length(btrim(customer)) between 1 and 100),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  details text not null default '' check (char_length(details) <= 3000),
  status text not null default 'received' check (status in ('received', 'inProgress', 'resolved')),
  created_at timestamptz not null default now()
);

create index if not exists inquiries_owner_id_idx on public.inquiries (user_id, id);
alter table public.inquiries enable row level security;
revoke all on table public.inquiries from public, anon, authenticated;
grant select, delete on table public.inquiries to authenticated;
grant insert (customer, title, details, status), update (customer, title, details, status)
  on public.inquiries to authenticated;

drop policy if exists own_inquiries on public.inquiries;
create policy own_inquiries on public.inquiries
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

commit;
