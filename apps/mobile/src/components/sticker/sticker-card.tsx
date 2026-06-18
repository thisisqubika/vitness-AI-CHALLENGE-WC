import { Pressable, StyleSheet, View } from "react-native";
import { type StickerCard as Card, RARITY_COLOR, RARITY_LABEL } from "@vitness/shared";

import { ThemedText } from "@/components/themed-text";

const W = 104;
const H = 150;

/**
 * A procedural sticker card rendered from its StickerCard payload — flag, name,
 * number, position, rarity frame. Original, factual data only (no licensed
 * imagery). `card={null}` renders the locked/missing silhouette. Golazo cards
 * get a replay affordance and call onReplay. See ticket VIT-6.
 */
export function StickerCard({
  card,
  count,
  onReplay,
}: {
  card: Card | null;
  count?: number;
  onReplay?: () => void;
}) {
  if (!card) {
    return (
      <View style={[styles.card, styles.locked]}>
        <ThemedText type="title" style={styles.lockMark}>
          ?
        </ThemedText>
      </View>
    );
  }

  const accent = RARITY_COLOR[card.rarity];
  const isGolazo = card.kind === "golazo";

  const body = (
    <View style={[styles.card, { borderColor: accent }]}>
      <View style={[styles.topBar, { backgroundColor: accent }]}>
        <ThemedText type="small" style={styles.flag}>
          {card.team.flagEmoji} {card.team.code}
        </ThemedText>
        {card.shirtNumber !== undefined ? (
          <ThemedText type="small" style={styles.number}>
            {card.shirtNumber}
          </ThemedText>
        ) : null}
      </View>

      <View style={styles.body}>
        {isGolazo ? (
          <ThemedText type="title" style={[styles.glyph, { color: accent }]}>
            ▶
          </ThemedText>
        ) : (
          <ThemedText type="title" style={[styles.bigNumber, { color: accent }]}>
            {card.shirtNumber ?? "★"}
          </ThemedText>
        )}
      </View>

      <View style={styles.footer}>
        <ThemedText type="smallBold" numberOfLines={1} style={styles.name}>
          {card.title}
        </ThemedText>
        {card.subtitle ? (
          <ThemedText type="small" numberOfLines={1} style={styles.sub}>
            {card.subtitle}
          </ThemedText>
        ) : null}
        <ThemedText type="small" style={[styles.rarity, { color: accent }]}>
          {RARITY_LABEL[card.rarity]}
          {count && count > 1 ? `  ×${count}` : ""}
        </ThemedText>
      </View>
    </View>
  );

  if (isGolazo && onReplay) {
    return <Pressable onPress={onReplay}>{body}</Pressable>;
  }
  return body;
}

const styles = StyleSheet.create({
  card: {
    width: W,
    height: H,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: "#16181c",
    overflow: "hidden",
  },
  locked: {
    borderColor: "#2E3135",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0d0f12",
  },
  lockMark: { color: "#3a3d42", fontSize: 32, lineHeight: 36 },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  flag: { color: "#ffffff", fontSize: 12 },
  number: { color: "#ffffff", fontSize: 12 },
  body: { flex: 1, alignItems: "center", justifyContent: "center" },
  bigNumber: { fontSize: 40, lineHeight: 44 },
  glyph: { fontSize: 32, lineHeight: 36 },
  footer: { paddingHorizontal: 8, paddingBottom: 8, gap: 1 },
  name: { color: "#ffffff", fontSize: 12 },
  sub: { color: "#9aa0a6", fontSize: 11 },
  rarity: { fontSize: 11, marginTop: 2 },
});
