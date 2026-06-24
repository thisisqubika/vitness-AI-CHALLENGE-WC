import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Svg, { Polyline } from "react-native-svg";
import { type StickerCard as Card, RARITY_COLOR } from "@vitness/shared";

import { ThemedText } from "@/components/themed-text";
import { Spacing, WebHeaderInset } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { GoalCelebration } from "./goal-animation";
import { StickerCard } from "./sticker-card";

interface Revealed {
  slot: number;
  card: Card;
}

const CARD_W = 104;
const CARD_H = 150;
const STAGGER = 150;
const PACK_W = 124;
const PACK_H = 172;
const TEAR_THRESHOLD = 104;
const TEAR_Y = 80; // split line: the top half above this rips off
const TEETH_H = 10;
/** Zigzag points for the ragged torn edge, spanning the pack width. */
const TEAR_ZIGZAG = (() => {
  const teeth = 10;
  const pts: string[] = [];
  for (let i = 0; i <= teeth; i++) {
    pts.push(`${((i * PACK_W) / teeth).toFixed(1)},${i % 2 === 0 ? 2 : TEETH_H - 2}`);
  }
  return pts.join(" ");
})();

/** Fire device haptics; no-op on web (expo-haptics is native-only). */
function haptic(kind: "light" | "medium" | "heavy" | "success") {
  if (Platform.OS === "web") return;
  if (kind === "success") {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    return;
  }
  const style =
    kind === "light"
      ? Haptics.ImpactFeedbackStyle.Light
      : kind === "heavy"
        ? Haptics.ImpactFeedbackStyle.Heavy
        : Haptics.ImpactFeedbackStyle.Medium;
  Haptics.impactAsync(style).catch(() => {});
}

/**
 * Opens a pack: calls the server-authoritative open_pack RPC (replay-safe) on
 * mount so contents are persisted before anything shows, then gates the reveal
 * behind a drag-to-tear gesture. Re-opening the same pack returns the same
 * contents (idempotent). See ticket VIT-6.
 *
 * Juiced with Reanimated 4 worklets + gesture-handler: the sheet springs up, a
 * sealed pack is dragged open (the tear seam glows with drag distance), then
 * cards flip + scale in on a stagger. Rare/golazo cards add a pulsing halo and
 * shimmer; golazo also gets a burst ring. Haptics fire on tear and on
 * special-card reveals (native only). See ticket VIT-7.
 */
export function PackOpening({ packId, onDone }: { packId: string; onDone: () => void }) {
  const [cards, setCards] = useState<Revealed[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"sealed" | "ripping" | "reveal">("sealed");
  const [celebrated, setCelebrated] = useState(false);

  const backdrop = useSharedValue(0);
  const sheet = useSharedValue(0);
  const drag = useSharedValue(0);
  const tear = useSharedValue(0);

  useEffect(() => {
    backdrop.value = withTiming(1, { duration: 220 });
    sheet.value = withSpring(1, { damping: 14, stiffness: 140, mass: 0.9 });
  }, [backdrop, sheet]);

  useEffect(() => {
    let active = true;
    (async () => {
      // Server-authoritative roll: persists the pulled cards to user_stickers and
      // flips the pack to opened (idempotent — reopening returns the same cards).
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

  const startRip = () => {
    setPhase("ripping");
    haptic("heavy");
    tear.value = withTiming(1, { duration: 480, easing: Easing.out(Easing.quad) });
    // Let the top half visibly rip off before swapping in the reveal.
    setTimeout(() => setPhase("reveal"), 430);
  };

  const pan = Gesture.Pan()
    .enabled(phase === "sealed")
    .onUpdate((e) => {
      drag.value = Math.max(0, e.translationY);
    })
    .onEnd(() => {
      if (drag.value >= TEAR_THRESHOLD) {
        runOnJS(startRip)();
      } else {
        drag.value = withSpring(0, { damping: 16, stiffness: 180 });
      }
    });

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: sheet.value,
    transform: [{ translateY: (1 - sheet.value) * 24 }, { scale: 0.92 + sheet.value * 0.08 }],
  }));

  const revealing = phase === "reveal";
  const showCards = revealing && cards !== null;
  const golazo = (cards ?? []).some((c) => c.card.kind === "golazo");

  return (
    <Animated.View style={[styles.backdrop, backdropStyle]}>
      <Animated.View style={[styles.sheet, sheetStyle]}>
        <ThemedText type="default" style={styles.title}>
          {error
            ? "No se pudo abrir el sobre"
            : showCards
              ? "¡Te salieron!"
              : phase === "sealed"
                ? "Abrí el sobre"
                : "Abriendo…"}
        </ThemedText>

        {error ? (
          <ThemedText type="small" style={styles.error}>
            {error}
          </ThemedText>
        ) : revealing ? (
          cards ? (
            <View style={styles.row}>
              {cards.map((c, i) => (
                <RevealCard key={c.slot} card={c.card} index={i} />
              ))}
            </View>
          ) : (
            <View style={styles.packArea} />
          )
        ) : (
          <TearablePack pan={pan} drag={drag} tear={tear} />
        )}

        <Pressable
          style={styles.done}
          onPress={showCards ? onDone : phase === "sealed" ? startRip : undefined}
          disabled={phase === "ripping"}>
          <ThemedText type="small" style={styles.doneText}>
            {showCards ? "Sumar al álbum" : phase === "sealed" ? "Abrir sobre ▸" : "Abriendo…"}
          </ThemedText>
        </Pressable>
      </Animated.View>

      {showCards && golazo && !celebrated ? <GoalCelebration onDone={() => setCelebrated(true)} /> : null}
    </Animated.View>
  );
}

/** The blue pack face (emblem + wordmark), drawn full-height and clipped into halves. */
function PackFace() {
  return (
    <View style={styles.packFace}>
      <View style={styles.packEmblem}>
        <ThemedText type="title" style={styles.packBall}>
          ⚽
        </ThemedText>
        <ThemedText type="smallBold" style={styles.packWord}>
          VITNESS
        </ThemedText>
      </View>
    </View>
  );
}

/** Ragged torn paper edge drawn across the pack width at the tear line. */
function TornEdge() {
  return (
    <Svg width={PACK_W} height={TEETH_H}>
      <Polyline points={TEAR_ZIGZAG} fill="none" stroke="#CFE3F8" strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}

/**
 * The sealed pack, split into a top and bottom half along a ragged tear line.
 * Dragging lifts the top half (seam glows); past the threshold the top half
 * rips off — flying up, rotating and fading — while the bottom half settles,
 * revealing the cards behind it.
 */
function TearablePack({
  pan,
  drag,
  tear,
}: {
  pan: ReturnType<typeof Gesture.Pan>;
  drag: SharedValue<number>;
  tear: SharedValue<number>;
}) {
  const topStyle = useAnimatedStyle(() => {
    const prog = Math.min(drag.value / TEAR_THRESHOLD, 1);
    return {
      opacity: 1 - tear.value,
      transform: [
        { translateY: -prog * 10 - tear.value * 160 },
        { translateX: -tear.value * 20 },
        { rotate: `${-prog * 2 - tear.value * 22}deg` },
      ],
    };
  });

  const bottomStyle = useAnimatedStyle(() => {
    const prog = Math.min(drag.value / TEAR_THRESHOLD, 1);
    return {
      opacity: 1 - tear.value * 0.3,
      transform: [{ translateY: prog * 3 + tear.value * 12 }],
    };
  });

  return (
    <View style={styles.packArea}>
      <GestureDetector gesture={pan}>
        <View style={styles.packBox}>
          <Animated.View style={[styles.halfBottom, bottomStyle]}>
            <View style={styles.halfBottomInner}>
              <View style={styles.faceShift}>
                <PackFace />
              </View>
            </View>
            <View style={styles.tornEdge}>
              <TornEdge />
            </View>
          </Animated.View>

          <Animated.View style={[styles.halfTop, topStyle]}>
            <View style={styles.halfTopInner}>
              <PackFace />
            </View>
            <View style={styles.tornEdge}>
              <TornEdge />
            </View>
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  );
}

/**
 * A single revealed card: flips in (rotateY) while scaling and sliding up on a
 * per-index stagger. Rare/golazo add a pulsing accent halo + a one-shot shimmer
 * sweep; golazo also fires a burst ring and a heavier overshoot once it lands.
 * Haptics fire as each special card lands (native only).
 */
function RevealCard({ card, index }: { card: Card; index: number }) {
  const reveal = useSharedValue(0);
  const halo = useSharedValue(0);
  const shimmer = useSharedValue(-1);
  const burst = useSharedValue(0);

  const accent = RARITY_COLOR[card.rarity];
  const special = card.rarity !== "common";
  const isLegendary = card.rarity === "legendary";
  const delay = index * STAGGER;

  useEffect(() => {
    reveal.value = withDelay(
      delay,
      withSpring(1, { damping: isLegendary ? 8 : 11, stiffness: isLegendary ? 95 : 110, mass: 0.8 }),
    );
    if (special) {
      halo.value = withDelay(
        delay + 260,
        withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true),
      );
      shimmer.value = withDelay(
        delay + 300,
        withSequence(withTiming(2, { duration: 750, easing: Easing.in(Easing.quad) }), withTiming(2, { duration: 0 })),
      );
    }
    if (isLegendary) {
      burst.value = withDelay(delay + 180, withTiming(1, { duration: 620, easing: Easing.out(Easing.quad) }));
    }
    if (special && !isLegendary) {
      // golazo haptic is owned by the goal celebration overlay
      const t = setTimeout(() => haptic("light"), delay + 180);
      return () => clearTimeout(t);
    }
  }, [delay, special, isLegendary, reveal, halo, shimmer, burst]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [
      { perspective: 800 },
      { translateY: (1 - reveal.value) * 30 },
      { scale: 0.5 + reveal.value * 0.5 },
      { rotateY: `${(1 - reveal.value) * 90}deg` },
    ],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: halo.value * 0.55 * reveal.value,
    transform: [{ scale: 1.04 + halo.value * 0.06 }],
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: shimmer.value >= 0 && shimmer.value <= 1 ? 0.7 : 0,
    transform: [{ translateX: shimmer.value * (CARD_W + 60) - 30 }, { rotate: "18deg" }],
  }));

  const burstStyle = useAnimatedStyle(() => ({
    opacity: (1 - burst.value) * 0.8,
    transform: [{ scale: 0.5 + burst.value * 1.4 }],
  }));

  return (
    <View style={styles.cardSlot}>
      {isLegendary ? <Animated.View style={[styles.burst, { borderColor: accent }, burstStyle]} /> : null}
      {special ? <Animated.View style={[styles.halo, { backgroundColor: accent }, haloStyle]} /> : null}
      <Animated.View style={cardStyle}>
        <View style={styles.clip}>
          <StickerCard card={card} />
          {special ? <Animated.View style={[styles.shimmer, shimmerStyle]} /> : null}
        </View>
      </Animated.View>
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
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    // Clear the fixed web top-nav so the overlay sits below it (never under it).
    paddingTop: WebHeaderInset + Spacing.three,
  },
  sheet: { backgroundColor: "#111316", borderRadius: Spacing.four, padding: Spacing.four, gap: Spacing.three, alignItems: "center" },
  title: { color: "#ffffff" },
  row: { flexDirection: "row", gap: Spacing.two, justifyContent: "center" },
  error: { color: "#F0997B" },
  packArea: { width: PACK_W + 40, height: CARD_H + 24, alignItems: "center", justifyContent: "center" },
  packBox: { width: PACK_W, height: PACK_H },
  packFace: {
    width: PACK_W,
    height: PACK_H,
    borderRadius: 14,
    backgroundColor: "#185FA5",
    borderWidth: 2,
    borderColor: "#2E7BC9",
    alignItems: "center",
    justifyContent: "center",
  },
  halfTop: { position: "absolute", top: 0, left: 0, width: PACK_W, height: TEAR_Y },
  halfTopInner: { width: PACK_W, height: TEAR_Y, overflow: "hidden" },
  halfBottom: { position: "absolute", top: 0, left: 0, width: PACK_W, height: PACK_H },
  halfBottomInner: {
    position: "absolute",
    top: TEAR_Y,
    left: 0,
    width: PACK_W,
    height: PACK_H - TEAR_Y,
    overflow: "hidden",
  },
  faceShift: { marginTop: -TEAR_Y },
  tornEdge: { position: "absolute", top: TEAR_Y - TEETH_H / 2, left: 0 },
  packEmblem: { alignItems: "center", gap: 6 },
  packBall: { fontSize: 44, lineHeight: 48 },
  packWord: { color: "#DCEBFB", letterSpacing: 2 },
  cardSlot: { width: CARD_W, height: CARD_H, alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute", width: CARD_W, height: CARD_H, borderRadius: 16 },
  burst: {
    position: "absolute",
    width: CARD_W,
    height: CARD_H,
    borderRadius: 18,
    borderWidth: 3,
  },
  clip: { width: CARD_W, height: CARD_H, borderRadius: 12, overflow: "hidden" },
  shimmer: {
    position: "absolute",
    top: -30,
    bottom: -30,
    width: 26,
    backgroundColor: "rgba(255,255,255,0.75)",
  },
  done: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    backgroundColor: "#185FA5",
    borderRadius: 999,
  },
  doneText: { color: "#ffffff" },
});
