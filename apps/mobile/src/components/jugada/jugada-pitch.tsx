import { useState } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import type { PlayScript } from "@vitness/shared";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import JugadaCanvas from "./jugada-canvas";

const PITCH_RATIO = 80 / 120;

/**
 * Full reconstruction view: the animated 2D pitch plus title, replay, and close
 * controls. The SVG canvas renders the same on web and native. See ticket VIT-3.
 */
export function JugadaPitch({
  script,
  title,
  onClose,
}: {
  script: PlayScript;
  title: string;
  onClose: () => void;
}) {
  const { width: screenW } = useWindowDimensions();
  const [playToken, setPlayToken] = useState(0);

  const width = Math.min(screenW - Spacing.three * 2, 520);
  const height = Math.round(width * PITCH_RATIO);

  const canvas = <JugadaCanvas script={script} width={width} height={height} playToken={playToken} />;

  return (
    <View style={styles.backdrop}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <ThemedText type="small" themeColor="textSecondary">
            La jugada
          </ThemedText>
          <Pressable onPress={onClose} hitSlop={Spacing.two}>
            <ThemedText type="link">Close</ThemedText>
          </Pressable>
        </View>

        <ThemedText type="default" style={styles.title}>
          {title}
        </ThemedText>

        <View style={[styles.canvasWrap, { width, height }]}>{canvas}</View>

        <Pressable style={styles.replay} onPress={() => setPlayToken((n) => n + 1)}>
          <ThemedText type="small">↺ Replay</ThemedText>
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
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.three,
  },
  sheet: {
    backgroundColor: "#111316",
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.two,
    alignItems: "stretch",
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: "#ffffff" },
  canvasWrap: { borderRadius: Spacing.two, overflow: "hidden" },
  replay: {
    alignSelf: "center",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: "#212225",
    borderRadius: 999,
    marginTop: Spacing.one,
  },
});
