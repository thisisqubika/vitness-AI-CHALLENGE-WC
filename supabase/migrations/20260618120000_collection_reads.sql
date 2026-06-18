-- VIT-5 collection reads: the card render payload column and the policies that
-- let a user see its OWN packs/stickers (and the public catalog), but not other
-- users' collections. See docs/CONCEPT.md § The Collection and ticket VIT-5.

alter table stickers add column meta jsonb not null default '{}'::jsonb;

-- The sticker catalog is public within the app.
create policy "authenticated can read stickers"
  on stickers for select
  to authenticated
  using (true);

-- A user reads only its own packs and inventory.
create policy "read own packs"
  on packs for select
  to authenticated
  using (profile_id = auth.uid ());

create policy "read own stickers"
  on user_stickers for select
  to authenticated
  using (profile_id = auth.uid ());

-- Pack contents are readable only for packs the user owns.
create policy "read own pack contents"
  on pack_contents for select
  to authenticated
  using (
    exists (
      select 1 from packs
      where packs.id = pack_contents.pack_id and packs.profile_id = auth.uid ()
    )
  );
