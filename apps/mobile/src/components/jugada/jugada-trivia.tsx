import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import type { PlayScript, TriviaResult } from "@vitness/shared";

import { ThemedText } from "@/components/themed-text";
import { Brand, Spacing } from "@/constants/theme";
import { useJugadaTrivia } from "@/hooks/use-jugada-trivia";
import JugadaCanvas, { type Kit } from "./jugada-canvas";

const PITCH_RATIO = 80 / 120;
const CORRECT = "#16C47F";
const WRONG = "#E0563B";
const SURFACE = "#1B1E24";

/** Short role tag shown on each question card. */
function slotTag(slotId: string, role: string): string {
  if (slotId === "year") return "MUNDIAL";
  if (slotId === "bodypart") return "DEFINICIÓN";
  if (role === "scorer") return "EL GOL";
  if (role === "assist") return "LA ASISTENCIA";
  if (role === "origin") return "EL ORIGEN";
  return role.toUpperCase();
}

/**
 * The "who was in the play?" trivia overlay: a staged experience — watch the
 * anonymized reconstruction, then guess who was involved, then a celebratory
 * server-graded reveal with rewards. The answer key is never in the client;
 * submission goes to the submit-answer edge function. See ticket VIT-4.
 */
export function JugadaTrivia({
  script,
  providerEventId,
  title,
  onClose,
  onAwarded,
  homeKit,
  awayKit,
}: {
  script: PlayScript;
  providerEventId: string;
  title: string;
  onClose: () => void;
  onAwarded: () => void;
  homeKit?: Kit;
  awayKit?: Kit;
}) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const { challenge, loading, error, submit } = useJugadaTrivia(providerEventId);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<TriviaResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [playToken, setPlayToken] = useState(0);
  const [watched, setWatched] = useState(false);
  const [reveal, setReveal] = useState(false); // questions revealed

  const width = Math.min(screenW - Spacing.three * 2, 540);
  const height = Math.round(width * PITCH_RATIO);

  const slots = challenge?.distractors ?? [];
  const answeredCount = slots.filter((s) => answers[s.slotId] !== undefined).length;
  const allAnswered = slots.length > 0 && answeredCount === slots.length;
  const showQuestions = reveal || watched;

  async function lock() {
    setSubmitting(true);
    const r = await submit(answers);
    setSubmitting(false);
    if (r) {
      setResult(r);
      onAwarded();
      // Re-run the play once more, now with the players' numbers on the jerseys.
      setPlayToken((n) => n + 1);
    }
  }

  function replay() {
    setPlayToken((n) => n + 1);
  }

  return (
    <View style={styles.backdrop}>
      <View style={[styles.sheet, { maxHeight: screenH - Spacing.four * 2 }]}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <ThemedText type="smallBold" style={styles.kicker}>
              LA JUGADA · ¿VISTE?
            </ThemedText>
            <ThemedText type="default" style={styles.title} numberOfLines={1}>
              {title}
            </ThemedText>
          </View>
          <Pressable onPress={onClose} hitSlop={Spacing.two} style={styles.closeBtn}>
            <ThemedText type="small" style={styles.closeText}>
              ✕
            </ThemedText>
          </Pressable>
        </View>

        {/* Pitch */}
        <View style={[styles.canvasWrap, { width, height }]}>
          <JugadaCanvas
            script={script}
            width={width}
            height={height}
            playToken={playToken}
            revealed={!!result || (!loading && !challenge)}
            onComplete={() => setWatched(true)}
            homeKit={homeKit}
            awayKit={awayKit}
          />
          <Pressable style={styles.replayChip} onPress={replay}>
            <ThemedText type="small" style={styles.replayText}>
              ↺ Reviví
            </ThemedText>
          </Pressable>
        </View>

        <ScrollView style={{ width }} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {loading ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerNote}>
              Cargando la jugada…
            </ThemedText>
          ) : error ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerNote}>
              {error}
            </ThemedText>
          ) : !challenge ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerNote}>
              Reconstrucción estilizada — el desafío &ldquo;¿quién participó?&rdquo; llega para este partido.
            </ThemedText>
          ) : result ? (
            <ResultPanel result={result} />
          ) : !showQuestions ? (
            // Anticipation gate — watch first, then guess.
            <View style={styles.gate}>
              <ThemedText type="default" style={styles.gateTitle}>
                Mirá la jugada con atención
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.gateSub}>
                Después vas a tener que adivinar quién participó. Ganás monedas por cada acierto.
              </ThemedText>
              <Pressable style={styles.primaryBtn} onPress={() => setReveal(true)}>
                <ThemedText type="small" style={styles.primaryText}>
                  Estoy listo · Adivinar ▸
                </ThemedText>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.progressRow}>
                <ThemedText type="smallBold" style={styles.progressLabel}>
                  {answeredCount}/{slots.length} respondidas
                </ThemedText>
                <Pressable onPress={replay} hitSlop={Spacing.two}>
                  <ThemedText type="small" style={styles.replayInline}>
                    ↺ Ver de nuevo
                  </ThemedText>
                </Pressable>
              </View>

              {slots.map((slot) => {
                const picked = answers[slot.slotId];
                return (
                  <View key={slot.slotId} style={styles.card}>
                    <ThemedText type="smallBold" style={styles.cardTag}>
                      {slotTag(slot.slotId, slot.role)}
                    </ThemedText>
                    <ThemedText type="default" style={styles.cardPrompt}>
                      {slot.prompt}
                    </ThemedText>
                    <View style={styles.options}>
                      {slot.options.map((opt) => {
                        const isPicked = picked === opt.id;
                        return (
                          <Pressable
                            key={opt.id}
                            onPress={() => setAnswers((a) => ({ ...a, [slot.slotId]: opt.id }))}
                            style={[styles.option, isPicked && styles.optionPicked]}>
                            <ThemedText type="small" style={[styles.optionText, isPicked && styles.optionTextPicked]}>
                              {opt.label}
                            </ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                );
              })}

              <Pressable
                disabled={!allAnswered || submitting}
                onPress={lock}
                style={[styles.lock, { opacity: allAnswered && !submitting ? 1 : 0.45 }]}>
                <ThemedText type="default" style={styles.lockText}>
                  {submitting ? "Verificando…" : allAnswered ? "Confirmar respuestas" : `Faltan ${slots.length - answeredCount}`}
                </ThemedText>
              </Pressable>
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

function ResultPanel({ result }: { result: TriviaResult }) {
  const perfect = result.correctSlots === result.totalSlots;
  const ratio = result.totalSlots > 0 ? result.correctSlots / result.totalSlots : 0;
  const ringColor = perfect ? Brand.legendary : ratio >= 0.5 ? CORRECT : WRONG;

  return (
    <View style={styles.result}>
      <View style={[styles.scoreRing, { borderColor: ringColor }]}>
        <ThemedText type="default" style={styles.scoreNum}>
          {result.correctSlots}/{result.totalSlots}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          aciertos
        </ThemedText>
      </View>

      <ThemedText type="default" style={styles.resultHeadline}>
        {perfect ? "¡Memoria de crack! 🏆" : ratio >= 0.5 ? "¡Bien visto! 👏" : "Casi… mirá de nuevo 👀"}
      </ThemedText>

      {result.alreadyDone ? (
        <ThemedText type="small" themeColor="textSecondary">
          Ya jugaste esta — sin nuevas recompensas
        </ThemedText>
      ) : (
        <View style={styles.rewards}>
          <View style={styles.rewardChip}>
            <ThemedText type="default" style={styles.rewardValue}>
              +{result.coinsAwarded}
            </ThemedText>
            <ThemedText type="small" style={styles.rewardLabel}>
              🪙 monedas
            </ThemedText>
          </View>
          {result.packsAwarded ? (
            <View style={[styles.rewardChip, styles.rewardChipPack]}>
              <ThemedText type="default" style={styles.rewardValue}>
                +{result.packsAwarded}
              </ThemedText>
              <ThemedText type="small" style={styles.rewardLabel}>
                🎁 sobres
              </ThemedText>
            </View>
          ) : null}
        </View>
      )}
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
    backgroundColor: "rgba(0,0,0,0.78)",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.three,
  },
  sheet: {
    backgroundColor: "#101216",
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: Spacing.two },
  kicker: { color: Brand.accent, fontSize: 11, letterSpacing: 1 },
  title: { color: "#ffffff", fontSize: 17, fontWeight: "700", maxWidth: 420 },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { color: "#ffffff", fontSize: 14 },
  canvasWrap: { borderRadius: Spacing.three, overflow: "hidden", position: "relative" },
  replayChip: {
    position: "absolute",
    right: Spacing.two,
    bottom: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.2)",
  },
  replayText: { color: "#ffffff", fontWeight: "600" },
  body: { gap: Spacing.three, paddingTop: Spacing.three, paddingBottom: Spacing.two },
  centerNote: { textAlign: "center", paddingVertical: Spacing.four },

  // anticipation gate
  gate: { alignItems: "center", gap: Spacing.two, paddingVertical: Spacing.three },
  gateTitle: { color: "#ffffff", fontSize: 18, fontWeight: "700", textAlign: "center" },
  gateSub: { textAlign: "center", maxWidth: 360 },
  primaryBtn: {
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three,
    backgroundColor: Brand.accent,
    borderRadius: 999,
  },
  primaryText: { color: Brand.accentInk, fontWeight: "800" },

  // questions
  progressRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressLabel: { color: "#ffffff" },
  replayInline: { color: Brand.accent, fontWeight: "600" },
  card: {
    backgroundColor: SURFACE,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.06)",
  },
  cardTag: { color: Brand.accent, fontSize: 11, letterSpacing: 0.8 },
  cardPrompt: { color: "#ffffff", fontSize: 15, fontWeight: "600" },
  options: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  option: {
    minWidth: "47%",
    flexGrow: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  optionPicked: { borderColor: Brand.accent, backgroundColor: "rgba(22,196,127,0.14)" },
  optionText: { color: "#d7dbe0", textAlign: "center", fontWeight: "600" },
  optionTextPicked: { color: "#ffffff" },
  lock: {
    alignSelf: "stretch",
    alignItems: "center",
    paddingVertical: Spacing.three,
    backgroundColor: Brand.accent,
    borderRadius: 999,
    marginTop: Spacing.one,
  },
  lockText: { color: Brand.accentInk, fontWeight: "800" },

  // result
  result: { alignItems: "center", gap: Spacing.three, paddingVertical: Spacing.three },
  scoreRing: {
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SURFACE,
  },
  scoreNum: { color: "#ffffff", fontSize: 30, fontWeight: "800" },
  resultHeadline: { color: "#ffffff", fontSize: 18, fontWeight: "700", textAlign: "center" },
  rewards: { flexDirection: "row", gap: Spacing.two },
  rewardChip: {
    alignItems: "center",
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    backgroundColor: "rgba(22,196,127,0.14)",
    borderWidth: 1,
    borderColor: "rgba(22,196,127,0.4)",
  },
  rewardChipPack: { backgroundColor: "rgba(242,183,5,0.14)", borderColor: "rgba(242,183,5,0.45)" },
  rewardValue: { color: "#ffffff", fontSize: 24, fontWeight: "800" },
  rewardLabel: { color: "#c9ced4" },
});
