import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { useCollection } from "@/hooks/use-collection";
import { StickerCard } from "@/components/sticker/sticker-card";
import { PackOpening } from "@/components/sticker/pack-opening";
import JugadaCanvas from "@/components/jugada/jugada-canvas";
import { demoJugadaFor } from "@/data/demo-jugadas";

/**
 * Álbum — the collection screen. Shows the unopened-pack queue, the match
 * sticker album (owned cards vs locked slots) with completion, and replays a
 * golazo card's embedded reconstruction. See ticket VIT-6.
 */
export default function AlbumScreen() {
  const { width } = useWindowDimensions();
  const { stickers, ownedCount, total, unopenedPackIds, loading, refresh } = useCollection();
  const [openingPackId, setOpeningPackId] = useState<string | null>(null);
  const [golazoReplay, setGolazoReplay] = useState(false);

  const pct = total > 0 ? Math.round((ownedCount / total) * 100) : 0;
  const replayScript = demoJugadaFor("arg-mex-e10");
  const canvasW = Math.min(width - Spacing.three * 2, 480);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.headerRow}>
            <ThemedText type="subtitle" style={styles.heading}>
              Álbum
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {ownedCount}/{total} · {pct}%
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            Argentina vs Mexico
          </ThemedText>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
          </View>

          {unopenedPackIds.length > 0 ? (
            <Pressable style={styles.packBtn} onPress={() => setOpeningPackId(unopenedPackIds[0]!)}>
              <ThemedText type="small" style={styles.packText}>
                🎁 Open pack · {unopenedPackIds.length} waiting
              </ThemedText>
            </Pressable>
          ) : (
            <ThemedView type="backgroundElement" style={styles.hint}>
              <ThemedText type="small" themeColor="textSecondary">
                No packs yet — win jugada trivia to earn them.
              </ThemedText>
            </ThemedView>
          )}

          {loading ? (
            <ThemedText type="small" themeColor="textSecondary">
              Loading album…
            </ThemedText>
          ) : (
            <View style={styles.grid}>
              {stickers.map((s) => (
                <StickerCard
                  key={s.id}
                  card={s.owned ? s.card : null}
                  count={s.count}
                  onReplay={s.card.kind === "golazo" ? () => setGolazoReplay(true) : undefined}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {openingPackId ? (
        <PackOpening
          packId={openingPackId}
          onDone={() => {
            setOpeningPackId(null);
            refresh();
          }}
        />
      ) : null}

      {golazoReplay && replayScript ? (
        <View style={styles.replayBackdrop}>
          <View style={styles.replaySheet}>
            <ThemedText type="default" style={styles.replayTitle}>
              Messi · 76&apos; winner
            </ThemedText>
            <JugadaCanvas
              script={replayScript}
              width={canvasW}
              height={Math.round(canvasW * (80 / 120))}
              playToken={1}
            />
            <Pressable style={styles.packBtn} onPress={() => setGolazoReplay(false)}>
              <ThemedText type="small" style={styles.packText}>
                Close
              </ThemedText>
            </Pressable>
          </View>
        </View>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, width: "100%", maxWidth: MaxContentWidth, alignSelf: "center" },
  content: {
    padding: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.two,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  heading: { fontSize: 28, lineHeight: 34 },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#212225",
    overflow: "hidden",
    marginVertical: Spacing.one,
  },
  progressFill: { height: "100%", backgroundColor: "#1D9E75" },
  packBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: "#185FA5",
    borderRadius: 999,
    marginVertical: Spacing.one,
  },
  packText: { color: "#ffffff" },
  hint: { borderRadius: Spacing.two, padding: Spacing.three, marginVertical: Spacing.one },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two, justifyContent: "flex-start" },
  replayBackdrop: {
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
  replaySheet: { backgroundColor: "#111316", borderRadius: Spacing.four, padding: Spacing.three, gap: Spacing.two, alignItems: "center" },
  replayTitle: { color: "#ffffff" },
});
