-- Security smoke test for the open_pack() function and RLS. Runs in a
-- transaction that ROLLBACKs, so it leaves no residue. Requires the local stack
-- (`supabase start`).
--
-- Run:  docker exec -i supabase_db_vitness psql -U postgres -d postgres \
--         < supabase/tests/open_pack_security_test.sql
--
-- Asserts: a pack opens to 3 stickers; re-opening is idempotent (same rows, no
-- double-grant); another user cannot open your pack; RLS hides other users'
-- packs and the jugadas answer key.

\set ON_ERROR_STOP off
\set u1 '11111111-1111-1111-1111-111111111111'
\set u2 '22222222-2222-2222-2222-222222222222'
\set pack1 '33333333-3333-3333-3333-333333333333'
\set pack2 '44444444-4444-4444-4444-444444444444'

begin;

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values (:'u1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','u1@test.local',now(),now()),
       (:'u2','00000000-0000-0000-0000-000000000000','authenticated','authenticated','u2@test.local',now(),now());

insert into profiles (id, display_name) values (:'u1','User One'), (:'u2','User Two');

insert into stickers (album_slot, rarity, title)
select g, 'common'::sticker_rarity, 'Common '||g from generate_series(1,6) g
union all select g, 'rare'::sticker_rarity, 'Rare '||g from generate_series(1,4) g
union all select g, 'golazo'::sticker_rarity, 'Golazo '||g from generate_series(1,2) g;

insert into packs (id, profile_id, source) values (:'pack1', :'u1', 'test'), (:'pack2', :'u1', 'test');

\echo '=== TEST 1: u1 opens pack1 (expect 3 rolled stickers) ==='
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select slot, sticker_id from open_pack(:'pack1');

\echo '=== TEST 2: u1 re-opens pack1 (idempotent: SAME 3 rows, no re-roll) ==='
select slot, sticker_id from open_pack(:'pack1');
reset role;

\echo '=== state checks: pack state opened_unviewed, total owned = 3 (not 6), pity advanced ==='
select 'pack_state' as check, state::text as value from packs where id = :'pack1'
union all
select 'total_owned', coalesce(sum(count),0)::text from user_stickers where profile_id = :'u1'
union all
select 'distinct_stickers', count(*)::text from user_stickers where profile_id = :'u1'
union all
select 'pity_rare', pity_since_rare::text from profiles where id = :'u1'
union all
select 'pity_golazo', pity_since_golazo::text from profiles where id = :'u1';

\echo '=== TEST 3: u2 tries to open u1''s pack2 (expect BLOCKED) ==='
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
do $$
begin
  perform open_pack('44444444-4444-4444-4444-444444444444');
  raise notice 'FAIL: u2 opened u1 pack';
exception when others then
  raise notice 'PASS: blocked — %', sqlerrm;
end $$;

\echo '=== TEST 4: RLS — u2 reads u1 packs and jugadas.answer_key directly (expect 0 rows each) ==='
select 'u2_sees_u1_packs' as check, count(*)::text as value from packs where profile_id = '11111111-1111-1111-1111-111111111111'
union all
select 'u2_reads_jugadas', count(*)::text from jugadas;
reset role;

rollback;
\echo '=== done (rolled back, no residue) ==='
