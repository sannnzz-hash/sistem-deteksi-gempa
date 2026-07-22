-- ============================================
-- SCHEMA SUPABASE - SISTEM DETEKSI GEMPA ESP32
-- Jalankan di: Supabase Dashboard > SQL Editor
-- ============================================

create table if not exists public.earthquake_events (
  id           bigint generated always as identity primary key,
  status       text not null check (status in ('GEMPA', 'AKTIVITAS_MANUSIA', 'NORMAL')),
  sw420        boolean not null default false,
  mpu6050      boolean not null default false,
  pir          boolean not null default false,
  led          boolean not null default false,
  buzzer       boolean not null default false,
  pintu_terbuka boolean not null default false,
  device_id    text default 'esp32-01',
  created_at   timestamptz not null default now()
);

-- Index untuk query history & status terbaru lebih cepat
create index if not exists idx_earthquake_events_created_at
  on public.earthquake_events (created_at desc);

create index if not exists idx_earthquake_events_status
  on public.earthquake_events (status);

-- Aktifkan Row Level Security
alter table public.earthquake_events enable row level security;

-- Backend akan pakai SERVICE ROLE KEY (bypass RLS), jadi policy di bawah
-- hanya untuk jaga-jaga bila ada akses via anon key (misal untuk realtime di frontend).
create policy "Allow read for anon"
  on public.earthquake_events
  for select
  to anon
  using (true);

-- Aktifkan Realtime (opsional, kalau mau frontend dengar update langsung dari Supabase)
alter publication supabase_realtime add table public.earthquake_events;
