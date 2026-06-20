import { useCallback, useEffect, useState } from "react";
import type { StickerCard } from "@vitness/shared";

import { supabase } from "@/lib/supabase";

export interface BadgeSticker {
  id: string;
  card: StickerCard;
  owned: boolean;
}

export interface MegaGroup {
  group: string;
  teams: BadgeSticker[];
}

interface MegaAlbumState {
  groups: MegaGroup[];
  ownedCount: number;
  total: number;
  loading: boolean;
  refresh: () => void;
}

interface BadgeRow {
  id: string;
  album_slot: number;
  meta: StickerCard;
}

/**
 * The mega-album: the 48 WC 2026 team badges (match_id null) merged with what
 * the user owns, grouped by tournament group. Badges roll from any pack, so the
 * mega-album fills as you open packs. See ticket VIT-10.
 */
export function useMegaAlbum(): MegaAlbumState {
  const [groups, setGroups] = useState<MegaGroup[]>([]);
  const [ownedCount, setOwnedCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    void (async () => {
      const [{ data: badges }, { data: owned }] = await Promise.all([
        supabase.from("stickers").select("id, album_slot, meta").is("match_id", null).order("album_slot"),
        supabase.from("user_stickers").select("sticker_id"),
      ]);
      const ownedSet = new Set(((owned as { sticker_id: string }[]) ?? []).map((r) => r.sticker_id));
      const rows = ((badges as BadgeRow[]) ?? []).map((b) => ({
        id: b.id,
        card: b.meta,
        owned: ownedSet.has(b.id),
      }));

      const byGroup = new Map<string, BadgeSticker[]>();
      for (const r of rows) {
        const g = r.card.group ?? "—";
        if (!byGroup.has(g)) byGroup.set(g, []);
        byGroup.get(g)!.push(r);
      }
      setGroups([...byGroup.entries()].map(([group, teams]) => ({ group, teams })));
      setOwnedCount(rows.filter((r) => r.owned).length);
      setTotal(rows.length);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { groups, ownedCount, total, loading, refresh };
}
