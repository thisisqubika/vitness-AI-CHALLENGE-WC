import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, MaxContentWidth, Spacing, WebHeaderInset } from "@/constants/theme";
import { useCollection } from "@/hooks/use-collection";
import { StickerCard } from "@/components/sticker/sticker-card";
import { JugadaTrivia } from "@/components/jugada/jugada-trivia";
import { retroJugadaById } from "@/data/retro";

/**
 * Golazos — the special golazo cards, separated from the player album. Each
 * owned golazo unlocks a "historic moment": a real StatsBomb goal of that same
 * player, playable as a jugada-trivia reconstruction. Locked golazos tease the
 * moment they'd unlock. See ticket VIT-9.
 */
export default function GolazosScreen() {
  const { stickers, loading, refresh } = useCollection();
  const [openMomentId, setOpenMomentId] = useState<string | null>(null);

  const golazos = useMemo(() => stickers.filter((s) => s.card.kind === "golazo"), [stickers]);
  const ownedCount = golazos.filter((g) => g.owned).length;
  const openJugada = openMomentId ? retroJugadaById(openMomentId) : null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.headerRow}>
            <ThemedText type="subtitle" style={styles.heading}>
              Golazos
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {ownedCount}/{golazos.length}
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            Pull a golazo to unlock that player&apos;s real historic goal.
          </ThemedText>

          {loading ? (
            <ThemedText type="small" themeColor="textSecondary">
              Loading…
            </ThemedText>
          ) : golazos.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.empty}>
              <ThemedText type="small" themeColor="textSecondary">
                No golazos in this album yet.
              </ThemedText>
            </ThemedView>
          ) : (
            golazos.map((g) => {
              const moment = retroJugadaById(g.card.historicMomentId);
              return (
                <ThemedView key={g.id} type="backgroundElement" style={styles.card}>
                  <StickerCard card={g.owned ? g.card : null} />
                  <View style={styles.info}>
                    <ThemedText type="default" style={styles.title}>
                      {g.card.title}
                    </ThemedText>
                    {g.owned ? (
                      moment ? (
                        <>
                          <ThemedText type="small" style={styles.unlocked}>
                            ★ Historic moment unlocked
                          </ThemedText>
                          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
                            ▶ {moment.title}
                          </ThemedText>
                          <Pressable style={styles.playBtn} onPress={() => setOpenMomentId(moment.providerEventId)}>
                            <ThemedText type="small" style={styles.playText}>
                              Play the moment
                            </ThemedText>
                          </Pressable>
                        </>
                      ) : (
                        <ThemedText type="small" themeColor="textSecondary">
                          No historic moment linked.
                        </ThemedText>
                      )
                    ) : (
                      <ThemedText type="small" themeColor="textSecondary">
                        🔒 Pull this golazo to unlock {g.card.playerName ?? "the player"}&apos;s real historic goal.
                      </ThemedText>
                    )}
                  </View>
                </ThemedView>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>

      {openJugada ? (
        <JugadaTrivia
          script={openJugada.playScript}
          providerEventId={openJugada.providerEventId}
          title={openJugada.title}
          homeKit={openJugada.home}
          awayKit={openJugada.away}
          onClose={() => setOpenMomentId(null)}
          onAwarded={refresh}
        />
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, width: "100%", maxWidth: MaxContentWidth, alignSelf: "center" },
  content: {
    padding: Spacing.three,
    paddingTop: Spacing.four + WebHeaderInset,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.two,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  heading: { fontSize: 28, lineHeight: 34 },
  empty: { borderRadius: Spacing.two, padding: Spacing.three, marginTop: Spacing.one },
  card: {
    flexDirection: "row",
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    marginTop: Spacing.one,
    alignItems: "center",
  },
  info: { flex: 1, gap: 4 },
  title: { color: "#ffffff" },
  unlocked: { color: "#EF9F27" },
  playBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: "#185FA5",
    borderRadius: 999,
    marginTop: Spacing.one,
  },
  playText: { color: "#ffffff" },
});
