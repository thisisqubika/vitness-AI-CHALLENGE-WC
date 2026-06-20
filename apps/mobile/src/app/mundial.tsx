import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { useMegaAlbum } from "@/hooks/use-mega-album";
import { StickerCard } from "@/components/sticker/sticker-card";

/**
 * Mundial '26 — the tournament-wide mega-album: all 48 team badges across the 12
 * groups, owned vs locked, with completion. Badges roll from any pack. See
 * ticket VIT-10.
 */
export default function MundialScreen() {
  const { groups, ownedCount, total, loading } = useMegaAlbum();
  const pct = total > 0 ? Math.round((ownedCount / total) * 100) : 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.headerRow}>
            <ThemedText type="subtitle" style={styles.heading}>
              Mundial &apos;26
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {ownedCount}/{total} teams · {pct}%
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            Collect every nation — badges drop from any pack.
          </ThemedText>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
          </View>

          {loading ? (
            <ThemedText type="small" themeColor="textSecondary">
              Loading the tournament…
            </ThemedText>
          ) : (
            groups.map((g) => (
              <View key={g.group} style={styles.group}>
                <ThemedText type="smallBold" style={styles.groupTitle}>
                  {g.group}
                </ThemedText>
                <View style={styles.grid}>
                  {g.teams.map((t) => (
                    <StickerCard key={t.id} card={t.owned ? t.card : null} />
                  ))}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
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
  group: { gap: Spacing.one, marginTop: Spacing.two },
  groupTitle: { color: "#9aa0a6" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
});
