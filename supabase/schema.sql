-- Pop Cat Check-in schema
-- Run this entire file in Supabase Dashboard > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.game_settings (
  id integer primary key default 1 check (id = 1),
  target_taps integer not null default 100 check (target_taps > 0),
  success_message text not null default 'เช็คอินครบ 100% แล้ว!',
  image_url text,
  status text not null default 'waiting' check (status in ('waiting','playing','completed')),
  total_taps bigint not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.game_settings (id) values (1) on conflict (id) do nothing;

-- Private roster. Public users should only see the directory view, not student_code.
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  prefix text not null default '',
  first_name text not null,
  last_name text not null,
  student_code text not null unique,
  tap_count bigint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.player_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references public.students(id) on delete cascade,
  joined_at timestamptz not null default now()
);

-- This view intentionally exposes only fields needed for the name picker.
create or replace view public.student_directory
with (security_barrier = true)
as
select id, prefix, first_name, last_name, tap_count
from public.students;

create or replace view public.active_player_directory
with (security_barrier = true)
as
select student_id, joined_at
from public.player_sessions;

alter table public.game_settings enable row level security;
alter table public.students enable row level security;
alter table public.player_sessions enable row level security;

-- Read-only public access to game state. No public writes to settings/roster.
drop policy if exists "Public can read game settings" on public.game_settings;
create policy "Public can read game settings" on public.game_settings for select to anon, authenticated using (true);

-- Admins authenticated through Supabase Auth can manage settings and roster.
drop policy if exists "Admins manage settings" on public.game_settings;
create policy "Admins manage settings" on public.game_settings for all to authenticated using (true) with check (true);
drop policy if exists "Admins manage students" on public.students;
create policy "Admins manage students" on public.students for all to authenticated using (true) with check (true);

-- Public directory exposes names only. Access to the underlying table remains restricted.
grant select on public.student_directory to anon, authenticated;
grant select on public.active_player_directory to anon, authenticated;
grant select, insert, update, delete on public.game_settings to authenticated;
grant select, insert, update, delete on public.students to authenticated;
grant select on public.game_settings to anon;

-- Only public directory reads are available to anonymous users.
-- Admin can inspect session list; player join/tap are handled through constrained RPCs.
drop policy if exists "Admins read sessions" on public.player_sessions;
create policy "Admins read sessions" on public.player_sessions for select to authenticated using (true);

-- Join a session. One student can join once; repeat calls are harmless.
create or replace function public.join_game(p_student_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare v_session public.player_sessions%rowtype;
begin
  if not exists (select 1 from public.students where id = p_student_id) then
    raise exception 'ไม่พบรายชื่อนักเรียน';
  end if;
  insert into public.player_sessions(student_id)
  values (p_student_id)
  on conflict (student_id) do nothing;
  select * into v_session from public.player_sessions where student_id = p_student_id;
  return json_build_object('session_id', v_session.id, 'joined_at', v_session.joined_at);
end;
$$;

-- Add taps atomically. One RPC call can submit a small batch of taps.
create or replace function public.add_taps(p_student_id uuid, p_amount integer)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare v_status text; v_target integer; v_total bigint; v_player bigint;
begin
  if p_amount is null or p_amount < 1 or p_amount > 25 then
    raise exception 'จำนวนแตะไม่ถูกต้อง';
  end if;
  select status, target_taps into v_status, v_target
  from public.game_settings where id = 1 for update;
  if v_status <> 'playing' then
    raise exception 'เกมยังไม่เริ่มหรือจบแล้ว';
  end if;
  if not exists (select 1 from public.player_sessions where student_id = p_student_id) then
    raise exception 'กรุณาเข้าร่วมเกมก่อน';
  end if;
  update public.students set tap_count = tap_count + p_amount where id = p_student_id returning tap_count into v_player;
  update public.game_settings
    set total_taps = least(total_taps + p_amount, target_taps),
        status = case when total_taps + p_amount >= target_taps then 'completed' else status end,
        updated_at = now()
    where id = 1
    returning total_taps, status into v_total, v_status;
  return json_build_object('player_taps', v_player, 'total_taps', v_total, 'status', v_status, 'target_taps', v_target);
end;
$$;

-- Start or reset the game; callable only by authenticated admins.
create or replace function public.admin_start_game(p_target integer, p_message text, p_image_url text, p_reset boolean default true)
returns json
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_target is null or p_target < 1 then raise exception 'เป้าหมายต้องมากกว่า 0'; end if;
  update public.game_settings
  set target_taps = p_target,
      success_message = coalesce(nullif(trim(p_message), ''), 'เช็คอินครบ 100% แล้ว!'),
      image_url = p_image_url,
      total_taps = case when p_reset then 0 else total_taps end,
      status = 'playing',
      updated_at = now()
  where id = 1;
  if p_reset then update public.students set tap_count = 0; end if;
  return json_build_object('status','playing');
end;
$$;

create or replace function public.admin_reset_game()
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.game_settings set total_taps = 0, status = 'waiting', updated_at = now() where id = 1;
  update public.students set tap_count = 0;
  delete from public.player_sessions;
end;
$$;

grant execute on function public.join_game(uuid) to anon, authenticated;
grant execute on function public.add_taps(uuid, integer) to anon, authenticated;
grant execute on function public.admin_start_game(integer, text, text, boolean) to authenticated;
grant execute on function public.admin_reset_game() to authenticated;

-- Realtime publication for game state and student scores.
do $$ begin
  alter publication supabase_realtime add table public.game_settings;
exception when duplicate_object then null;
when others then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.students;
exception when duplicate_object then null;
when others then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.player_sessions;
exception when duplicate_object then null;
when others then null;
end $$;

-- Create a Storage bucket named "game-assets" from Storage > Buckets and set it public,
-- or use the SQL below. Public read is intended for the game character image only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('game-assets', 'game-assets', true, 5242880, array['image/png'])
on conflict (id) do nothing;

drop policy if exists "Public can view game assets" on storage.objects;
create policy "Public can view game assets" on storage.objects for select using (bucket_id = 'game-assets');
drop policy if exists "Authenticated admins upload game assets" on storage.objects;
create policy "Authenticated admins upload game assets" on storage.objects for insert to authenticated with check (bucket_id = 'game-assets');
drop policy if exists "Authenticated admins update game assets" on storage.objects;
create policy "Authenticated admins update game assets" on storage.objects for update to authenticated using (bucket_id = 'game-assets') with check (bucket_id = 'game-assets');
drop policy if exists "Authenticated admins delete game assets" on storage.objects;
create policy "Authenticated admins delete game assets" on storage.objects for delete to authenticated using (bucket_id = 'game-assets');
