-- 환최몇? 선택형 서버 채점/리더보드 스키마
-- Supabase Dashboard > SQL Editor에서 한 번 실행하세요.

create extension if not exists pgcrypto;
create schema if not exists extensions;
create extension if not exists postgis with schema extensions;

create table if not exists public.transit_stops (
  source text not null,
  city_code text not null,
  local_id text not null,
  name text not null,
  stop_number text,
  mode text not null check (mode in ('bus', 'subway', 'train')),
  latitude double precision not null check (latitude between 30 and 40),
  longitude double precision not null check (longitude between 120 and 135),
  location extensions.geography(point, 4326) generated always as (
    extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326)::extensions.geography
  ) stored,
  is_active boolean not null default true,
  fetched_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (source, city_code, local_id)
);

create index if not exists transit_stops_location_idx
  on public.transit_stops using gist (location);

create index if not exists transit_stops_name_idx
  on public.transit_stops (name);

create table if not exists public.transit_services (
  source text not null,
  city_code text not null,
  local_id text not null,
  name text not null,
  mode text not null check (mode in ('bus', 'subway', 'train')),
  route_type text,
  start_stop_name text,
  end_stop_name text,
  first_vehicle_time text,
  last_vehicle_time text,
  interval_weekday_minutes integer check (interval_weekday_minutes >= 0),
  interval_saturday_minutes integer check (interval_saturday_minutes >= 0),
  interval_sunday_minutes integer check (interval_sunday_minutes >= 0),
  is_active boolean not null default true,
  fetched_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (source, city_code, local_id)
);

create index if not exists transit_services_city_name_idx
  on public.transit_services (city_code, name);

create table if not exists public.game_questions (
  id text primary key,
  minimum_transfers smallint not null check (minimum_transfers between 0 and 20),
  difficulty text not null check (difficulty in ('10', '50', '100')),
  is_active boolean not null default true,
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.leaderboard_scores (
  id uuid primary key default gen_random_uuid(),
  nickname text not null check (char_length(nickname) between 1 and 16),
  total_score integer not null check (total_score between 0 and 10000),
  exact_answers smallint not null check (exact_answers between 0 and 5),
  difficulty text not null check (difficulty in ('10', '50', '100', 'all')),
  rounds_count smallint not null default 5 check (rounds_count between 1 and 5),
  created_at timestamptz not null default now()
);

create index if not exists leaderboard_scores_rank_idx
  on public.leaderboard_scores (total_score desc, created_at asc);

alter table public.game_questions enable row level security;
alter table public.leaderboard_scores enable row level security;
alter table public.transit_stops enable row level security;
alter table public.transit_services enable row level security;

-- 문제 정답은 브라우저에서 읽을 수 없습니다.
revoke all on public.game_questions from anon, authenticated;
revoke all on public.transit_stops from anon, authenticated;
revoke all on public.transit_services from anon, authenticated;

-- 리더보드는 공개 조회만 허용합니다. 브라우저 직접 INSERT 정책은 만들지 않습니다.
grant select on public.leaderboard_scores to anon, authenticated;

drop policy if exists "Public leaderboard is readable" on public.leaderboard_scores;
create policy "Public leaderboard is readable"
  on public.leaderboard_scores
  for select
  to anon, authenticated
  using (true);

insert into public.game_questions (id, minimum_transfers, difficulty) values
  ('gangnam-jamsil', 0, '10'),
  ('gwanghwamun-yeouido', 0, '10'),
  ('haeundae-taejongdae', 1, '10'),
  ('suwon-pyeongtaek', 0, '50'),
  ('seoul-incheon', 0, '50'),
  ('gimpo-everland', 2, '50'),
  ('gwangju-jeonju', 1, '100'),
  ('seoul-daejeon', 0, '100'),
  ('daejeon-daegu', 0, '100'),
  ('seoul-busan', 0, '100'),
  ('mokpo-busan', 1, '100'),
  ('gangneung-jeonju', 3, '100'),
  ('daejeon-government', 0, '10'),
  ('seomyeon-haeundae', 0, '10'),
  ('osong-daejeon', 0, '50'),
  ('seoulforest-suwon', 0, '50')
on conflict (id) do update set
  minimum_transfers = excluded.minimum_transfers,
  difficulty = excluded.difficulty,
  verified_at = now();
