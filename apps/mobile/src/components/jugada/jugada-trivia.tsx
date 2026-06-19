import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import type { PlayScript, TriviaResult } from "@vitness/shared";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useJugadaTrivia } from "@/hooks/use-jugada-trivia";
import JugadaCanvas from "./jugada-canvas";

const PITCH_RATIO = 80 / 120;
const CORRECT = "#1D9E75";
const WRONG = "#D85A30";

/**
 * The "who was in the play?" trivia overlay: an anonymized reconstruction, a
 * question per slot, and a server-graded reveal with rewards. The answer key is
 * never in the client — submission goes to the submit-answer edge function. See
 * ticket VIT-4.
 */
export function JugadaTrivia({
  script,
  providerEventId,
  title,
  onClose,
  onAwarded,
}: {
  script: PlayScript;
  providerEventId: string;
  title: string;
  onClose: () => void;
  onAwarded: () => void;
}) {
  const { width: screenW } = useWindowDimensions();
  const { challenge, loading, error, submit } = useJugadaTrivia(providerEventId);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<TriviaResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [playToken, setPlayToken] = useState(0);

  const width = Math.min(screenW - Spacing.three * 2, 520);
  const height = Math.round(width * PITCH_RATIO);

  const slots = challenge?.distractors ?? [];
  const allAnswered = slots.length > 0 && slots.every((s) => answers[s.slotId] !== undefined);

  async function lock() {
    setSubmitting(true);
    const r = await submit(answers);
    setSubmitting(false);
    if (r) {
      setResult(r);
      onAwarded();
    }
  }

  return (
    <View style={styles.backdrop}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <ThemedText type="small" themeColor="textSecondary">
            La jugada — ¿viste?
          </ThemedText>
          <Pressable onPress={onClose} hitSlop={Spacing.two}>
            <ThemedText type="link">Close</ThemedText>
          </Pressable>
        </View>
        <ThemedText type="default" style={styles.title}>
          {title}
        </ThemedText>

        <View style={[styles.canvasWrap, { width, height }]}>
          <JugadaCanvas
            script={script}
            width={width}
            height={height}
            playToken={playToken}
            revealed={!!result || (!loading && !challenge)}
          />
        </View>
        <Pressable style={styles.replay} onPress={() => setPlayToken((n) => n + 1)}>
          <ThemedText type="small">↺ Replay</ThemedText>
        </Pressable>

        <ScrollView style={{ maxWidth: width }} contentContainerStyle={styles.questions}>
          {loading ? (
            <ThemedText type="small" themeColor="textSecondary">
              Loading challenge…
            </ThemedText>
          ) : error ? (
            <ThemedText type="small" themeColor="textSecondary">
              {error}
            </ThemedText>
          ) : !challenge ? (
            <ThemedText type="small" themeColor="textSecondary">
              Stylized reconstruction — &ldquo;who was in the play?&rdquo; coming for this match.
            </ThemedText>
          ) : (
            <>
              {slots.map((slot) => (
                <View key={slot.slotId} style={styles.slot}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {slot.prompt}
                  </ThemedText>
                  <View style={styles.options}>
                    {slot.options.map((opt) => {
                      const picked = answers[slot.slotId] === opt.id;
                      const isCorrect = result?.reveal[slot.slotId] === opt.id;
                      const bg = result
                        ? isCorrect
                          ? CORRECT
                          : picked
                            ? WRONG
                            : "#212225"
                        : picked
                          ? "#185FA5"
                          : "#212225";
                      return (
                        <Pressable
                          key={opt.id}
                          disabled={!!result}
                          onPress={() => setAnswers((a) => ({ ...a, [slot.slotId]: opt.id }))}
                          style={[styles.option, { backgroundColor: bg }]}>
                          <ThemedText type="small" style={styles.optionText}>
                            {opt.label}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}

              {result ? (
                <View style={styles.resultBox}>
                  <ThemedText type="default" style={styles.resultText}>
                    {result.correctSlots}/{result.totalSlots} correct
                  </ThemedText>
                  <ThemedText type="small" style={styles.resultSub}>
                    {result.alreadyDone
                      ? "Already played — no new rewards"
                      : `+${result.coinsAwarded} coins${result.packsAwarded ? ` · +${result.packsAwarded} packs` : ""}`}
                  </ThemedText>
                </View>
              ) : (
                <Pressable
                  disabled={!allAnswered || submitting}
                  onPress={lock}
                  style={[styles.lock, { opacity: allAnswered && !submitting ? 1 : 0.5 }]}>
                  <ThemedText type="small" style={styles.lockText}>
                    {submitting ? "Checking…" : "Lock answers"}
                  </ThemedText>
                </Pressable>
              )}
            </>
          )}
        </ScrollView>
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
  sheet: { backgroundColor: "#111316", borderRadius: Spacing.four, padding: Spacing.three, gap: Spacing.two },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: "#ffffff" },
  canvasWrap: { borderRadius: Spacing.two, overflow: "hidden" },
  replay: {
    alignSelf: "center",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    backgroundColor: "#212225",
    borderRadius: 999,
  },
  questions: { gap: Spacing.three, paddingTop: Spacing.two },
  slot: { gap: Spacing.one },
  options: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.one },
  option: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, borderRadius: 999 },
  optionText: { color: "#ffffff" },
  lock: {
    alignSelf: "center",
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    backgroundColor: "#185FA5",
    borderRadius: 999,
    marginTop: Spacing.one,
  },
  lockText: { color: "#ffffff" },
  resultBox: { alignItems: "center", gap: Spacing.half, marginTop: Spacing.one },
  resultText: { color: "#ffffff" },
  resultSub: { color: "#9FE1CB" },
});
