import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { StickerCard as Card } from "@vitness/shared";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { StickerCard } from "./sticker-card";

interface Revealed {
  slot: number;
  card: Card;
}

/**
 * Opens a pack: calls the server-authoritative open_pack RPC (replay-safe), then
 * fetches the rolled stickers' render payloads and reveals them as cards.
 * Re-opening the same pack returns the same contents (idempotent). See ticket
 * VIT-6.
 */
export function PackOpening({ packId, onDone }: { packId: string; onDone: () => void }) {
  const [cards, setCards] = useState<Revealed[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: rolled, error: openErr } = await supabase.rpc("open_pack", { p_pack_id: packId });
      if (!active) return;
      if (openErr) {
        setError(openErr.message);
        return;
      }
      const rows = (rolled as { slot: number; sticker_id: string }[]) ?? [];
      const ids = rows.map((r) => r.sticker_id);
      const { data: stickers } = await supabase.from("stickers").select("id, meta").in("id", ids);
      const metaById = new Map<string, Card>(
        ((stickers as { id: string; meta: Card }[]) ?? []).map((s) => [s.id, s.meta]),
      );
      if (!active) return;
      setCards(rows.map((r) => ({ slot: r.slot, card: metaById.get(r.sticker_id)! })).filter((c) => c.card));
    })();
    return () => {
      active = false;
    };
  }, [packId]);

  return (
    <View style={styles.backdrop}>
      <View style={styles.sheet}>
        <ThemedText type="default" style={styles.title}>
          {error ? "Could not open pack" : cards ? "You pulled" : "Opening pack…"}
        </ThemedText>

        {error ? (
          <ThemedText type="small" style={styles.error}>
            {error}
          </ThemedText>
        ) : (
          <View style={styles.row}>
            {(cards ?? []).map((c) => (
              <StickerCard key={c.slot} card={c.card} />
            ))}
          </View>
        )}

        <Pressable style={styles.done} onPress={onDone} disabled={!cards && !error}>
          <ThemedText type="small" style={styles.doneText}>
            {cards || error ? "Add to album" : "…"}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.three,
  },
  sheet: { backgroundColor: "#111316", borderRadius: Spacing.four, padding: Spacing.four, gap: Spacing.three, alignItems: "center" },
  title: { color: "#ffffff" },
  row: { flexDirection: "row", gap: Spacing.two, justifyContent: "center" },
  error: { color: "#F0997B" },
  done: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    backgroundColor: "#185FA5",
    borderRadius: 999,
  },
  doneText: { color: "#ffffff" },
});
