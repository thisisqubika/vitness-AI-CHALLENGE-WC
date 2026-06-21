import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MatchList } from "@/components/match/match-list";
import { MatchRoom } from "@/components/match/match-room";
import { JugadaTrivia } from "@/components/jugada/jugada-trivia";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, MaxContentWidth, Spacing, WebHeaderInset } from "@/constants/theme";
import { useSession } from "@/hooks/use-session";
import { retroJugadaOfTheDay } from "@/data/retro";

export default function HomeScreen() {
  const { ready, error } = useSession();
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [retroOpen, setRetroOpen] = useState(false);
  const retro = retroJugadaOfTheDay();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {error ? (
          <View style={styles.centered}>
            <ThemedText type="small" themeColor="textSecondary">
              {error}
            </ThemedText>
          </View>
        ) : !ready ? (
          <View style={styles.centered}>
            <ThemedText type="small" themeColor="textSecondary">
              Connecting…
            </ThemedText>
          </View>
        ) : selectedMatchId ? (
          <MatchRoom matchId={selectedMatchId} onBack={() => setSelectedMatchId(null)} />
        ) : (
          <View style={styles.list}>
            {retro ? (
              <Pressable
                onPress={() => setRetroOpen(true)}
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedView type="backgroundElement" style={styles.retroCard}>
                  <View style={styles.retroPlayBadge}>
                    <ThemedText type="default" style={styles.retroPlayIcon}>
                      ▶
                    </ThemedText>
                  </View>
                  <View style={styles.retroBody}>
                    <ThemedText type="smallBold" style={styles.retroKicker}>
                      JUGADA DEL DÍA · STATSBOMB
                    </ThemedText>
                    <ThemedText type="default" style={styles.retroTitle} numberOfLines={2}>
                      {retro.title}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      ¿Quién estuvo en la jugada? Acertá y ganá monedas →
                    </ThemedText>
                  </View>
                </ThemedView>
              </Pressable>
            ) : null}
            <MatchList onSelect={setSelectedMatchId} />
          </View>
        )}
      </SafeAreaView>

      {retroOpen && retro ? (
        <JugadaTrivia
          script={retro.playScript}
          providerEventId={retro.providerEventId}
          title={retro.title}
          homeKit={retro.home}
          awayKit={retro.away}
          onClose={() => setRetroOpen(false)}
          onAwarded={() => {}}
        />
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: "row", justifyContent: "center" },
  safeArea: {
    flex: 1,
    width: "100%",
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three + WebHeaderInset,
    paddingBottom: BottomTabInset + Spacing.three,
  },
  list: { flex: 1, gap: Spacing.three },
  pressed: { opacity: 0.7 },
  retroCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    borderWidth: 1,
    borderColor: "rgba(239,159,39,0.5)",
  },
  retroPlayBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EF9F27",
    alignItems: "center",
    justifyContent: "center",
  },
  retroPlayIcon: { color: "#1a1206", fontSize: 18, lineHeight: 20, marginLeft: 2 },
  retroBody: { flex: 1, gap: Spacing.half },
  retroKicker: { color: "#EF9F27", fontSize: 11, letterSpacing: 0.5 },
  retroTitle: { fontSize: 17, lineHeight: 22, fontWeight: "700" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
});
