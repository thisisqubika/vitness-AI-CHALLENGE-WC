-- open_pack: the server-authoritative, replay-safe pack roll.
-- Rolls contents inside ONE transaction and persists BEFORE the client sees
-- anything. Killing the app mid-animation or retrying the same pack id can
-- never re-roll. See docs/CONCEPT.md "Pack-opening protocol".

create or replace function open_pack (p_pack_id uuid)
returns table (slot integer, sticker_id uuid)
language plpgsql
security definer
set search_path = public
as $$
-- All locals are v_-prefixed, so any bare name that could be a column or an OUT
-- parameter (e.g. sticker_id in the ON CONFLICT target below) resolves to the
-- column, not the RETURNS TABLE output variable.
#variable_conflict use_column
declare
  v_profile uuid := auth.uid();
  v_match_id text;
  v_state pack_state;
  v_pity_rare integer;
  v_pity_golazo integer;
  v_slot integer;
  v_roll double precision;
  v_rarity sticker_rarity;
  v_sticker uuid;
begin
  -- Lock the pack row: ownership + state are checked under the lock so two
  -- concurrent opens (spam-tap / two devices) serialize and only one rolls.
  select p.state, p.match_id into v_state, v_match_id
  from packs p
  where p.id = p_pack_id and p.profile_id = v_profile
  for update;

  if not found then
    raise exception 'pack not found or not owned' using errcode = 'P0002';
  end if;

  -- Idempotent: an already-opened pack returns its persisted contents, never
  -- a fresh roll. This covers the network-drop-after-commit retry.
  if v_state <> 'unopened' then
    return query
      select pc.slot, pc.sticker_id from pack_contents pc where pc.pack_id = p_pack_id
      order by pc.slot;
    return;
  end if;

  select coins_pity.pity_since_rare, coins_pity.pity_since_golazo
    into v_pity_rare, v_pity_golazo
  from profiles coins_pity
  where coins_pity.id = v_profile
  for update;

  for v_slot in 0..2 loop
    v_roll := random();

    -- Pity timers: forced upgrades when the counters cross their thresholds.
    if v_pity_golazo >= 29 then
      v_rarity := 'golazo';
    elsif v_pity_rare >= 9 then
      v_rarity := (case when v_roll < 0.17 then 'golazo' else 'rare' end)::sticker_rarity;
    elsif v_roll < 0.05 then
      v_rarity := 'golazo';
    elsif v_roll < 0.30 then
      v_rarity := 'rare';
    else
      v_rarity := 'common';
    end if;

    if v_rarity = 'golazo' then
      v_pity_golazo := 0;
      v_pity_rare := 0;
    elsif v_rarity = 'rare' then
      v_pity_rare := 0;
      v_pity_golazo := v_pity_golazo + 1;
    else
      v_pity_rare := v_pity_rare + 1;
      v_pity_golazo := v_pity_golazo + 1;
    end if;

    -- Pick a random sticker of the rolled rarity, biased to this match's pool.
    select s.id into v_sticker
    from stickers s
    where s.rarity = v_rarity
      and (v_match_id is null or s.match_id = v_match_id or s.match_id is null)
    order by random()
    limit 1;

    if v_sticker is null then
      select s.id into v_sticker from stickers s where s.rarity = v_rarity order by random() limit 1;
    end if;

    if v_sticker is null then
      raise exception 'no sticker available for rarity %', v_rarity using errcode = 'P0001';
    end if;

    insert into pack_contents (pack_id, slot, sticker_id) values (p_pack_id, v_slot, v_sticker);

    insert into user_stickers (profile_id, sticker_id, count, provenance)
    values (v_profile, v_sticker, 1, 'VITNESSED · pack')
    on conflict (profile_id, sticker_id)
    do update set count = user_stickers.count + 1;
  end loop;

  update profiles
    set pity_since_rare = v_pity_rare, pity_since_golazo = v_pity_golazo
  where id = v_profile;

  update packs set state = 'opened_unviewed', opened_at = now() where id = p_pack_id;

  return query
    select pc.slot, pc.sticker_id from pack_contents pc where pc.pack_id = p_pack_id
    order by pc.slot;
end;
$$;

revoke all on function open_pack (uuid) from public;
grant execute on function open_pack (uuid) to authenticated;
