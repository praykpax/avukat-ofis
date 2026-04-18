-- =============================================
-- Avukat Ofis Yönetimi — Supabase Tablo Kurulumu
-- Supabase Dashboard > SQL Editor > buraya yapıştır > Run
-- =============================================

create table if not exists avukat_store (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

-- Row Level Security aç
alter table avukat_store enable row level security;

-- Tüm işlemlere izin ver (kişisel kullanım için)
-- Ekip kullanımında auth.uid() ile kısıtlayabilirsiniz
create policy "allow_all" on avukat_store
  for all
  using (true)
  with check (true);

-- updated_at otomatik güncellensin
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger avukat_store_updated_at
  before update on avukat_store
  for each row execute procedure update_updated_at();
