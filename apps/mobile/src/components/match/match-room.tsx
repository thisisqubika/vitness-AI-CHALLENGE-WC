import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { composePlayScript, type Match, type MatchEvent } from "@vitness/shared";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useMatchRoom } from "@/hooks/use-match-room";
import { useCoins } from "@/hooks/use-coins";
import { JugadaTrivia } from "@/components/jugada/jugada-trivia";
import { demoJugadaFor } from "@/data/demo-jugadas";
import { eventLabel } from "./event-label";
import { MomentumBar } from "./momentum-bar";

const STATUS_LABEL: Record<Match["status"], string> = {
  scheduled: "Kickoff soon",
  live: "LIVE",
  halftime: "Half-time",
  finished: "Full-time",
  abandoned: "Abandoned",
};

const STATUS_COLOR: Record<Match["status"], string> = {
  scheduled: "#60646C",
  live: "#D85A30",
  halftime: "#BA7517",
  finished: "#0F6E56",
  abandoned: "#60646C",
};

function teamName(match: Match, side: "home" | "away"): string {
  return side === "home" ? match.homeTeam : match.awayTeam;
}

function EventRow({
  match,
  event,
  onPress,
}: {
  match: Match;
  event: MatchEvent;
  onPress?: () => void;
}) {
  const { icon, text } = eventLabel(event);
  const side = teamName(match, event.team);
  const tappable = event.type === "goal" && onPress !== undefined;
  return (
    <View style={styles.eventRow}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.eventMinute}>
        {event.minute}&apos;
      </ThemedText>
      <ThemedText type="default" style={styles.eventIcon}>
        {icon}
      </ThemedText>
      <ThemedText type="small">
        {text} · {side}
      </ThemedText>
      {tappable ? (
        <ThemedText type="link" style={styles.watch} onPress={onPress}>
          ▶ Watch
        </ThemedText>
      ) : null}
    </View>
  );
}

export function MatchRoom({ matchId, onBack }: { matchId: string; onBack: () => void }) {
  const theme = useTheme();
  const { match, events, score, minute, loading, error } = useMatchRoom(matchId);
  const { coins, refresh: refreshCoins } = useCoins();
  const [openGoal, setOpenGoal] = useState<MatchEvent | null>(null);

  if (error) {
    return (
      <View style={styles.centered}>
        <ThemedText type="small" themeColor="textSecondary">
          {error}
        </ThemedText>
      </View>
    );
  }

  if (loading && !match) {
    return (
      <View style={styles.centered}>
        <ThemedText type="small" themeColor="textSecondary">
          Loading match…
        </ThemedText>
      </View>
    );
  }

  if (!match) {
    return (
      <View style={styles.centered}>
        <ThemedText type="small" themeColor="textSecondary">
          Match not found.
        </ThemedText>
      </View>
    );
  }

  const feed = [...events].reverse();

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Pressable onPress={onBack} hitSlop={Spacing.two}>
          <ThemedText type="link" themeColor="textSecondary">
            ‹ Matches
          </ThemedText>
        </Pressable>
        <View style={styles.coinsChip}>
          <ThemedText type="small" style={styles.coinsText}>
            🪙 {coins}
          </ThemedText>
        </View>
      </View>

      <ThemedView type="backgroundElement" style={styles.scoreCard}>
        <View style={styles.statusRow}>
          <View style={[styles.statusPill, { backgroundColor: STATUS_COLOR[match.status] }]}>
            <ThemedText type="small" style={styles.statusText}>
              {STATUS_LABEL[match.status]}
            </ThemedText>
          </View>
          {match.status === "live" ? (
            <ThemedText type="small" themeColor="textSecondary">
              {minute}&apos;
            </ThemedText>
          ) : null}
        </View>

        <View style={styles.scoreRow}>
          <ThemedText type="subtitle" style={styles.team}>
            {match.homeTeam}
          </ThemedText>
          <ThemedText type="title" style={styles.score}>
            {score.home}–{score.away}
          </ThemedText>
          <ThemedText type="subtitle" style={styles.team}>
            {match.awayTeam}
          </ThemedText>
        </View>

        <MomentumBar events={events} />
      </ThemedView>

      {feed.length === 0 ? (
        <View style={styles.centered}>
          <ThemedText type="small" themeColor="textSecondary">
            Kickoff soon — no events yet.
          </ThemedText>
        </View>
      ) : (
        <ScrollView style={styles.feed} contentContainerStyle={styles.feedContent}>
          {feed.map((event, i) => (
            <View
              key={`${event.providerEventId}-${i}`}
              style={[styles.eventWrap, { borderBottomColor: theme.backgroundElement }]}>
              <EventRow match={match} event={event} onPress={() => setOpenGoal(event)} />
            </View>
          ))}
        </ScrollView>
      )}

      {openGoal ? (
        <JugadaOverlay
          match={match}
          goal={openGoal}
          onClose={() => setOpenGoal(null)}
          onAwarded={refreshCoins}
        />
      ) : null}
    </View>
  );
}

function JugadaOverlay({
  match,
  goal,
  onClose,
  onAwarded,
}: {
  match: Match;
  goal: MatchEvent;
  onClose: () => void;
  onAwarded: () => void;
}) {
  const scorerId = goal.type === "goal" ? goal.scorerId : undefined;
  const script =
    demoJugadaFor(goal.providerEventId) ??
    composePlayScript({ providerEventId: goal.providerEventId, team: goal.team, scorerId });
  const title = `${goal.minute}' Goal — ${teamName(match, goal.team)}`;
  return (
    <JugadaTrivia
      script={script}
      providerEventId={goal.providerEventId}
      title={title}
      onClose={onClose}
      onAwarded={onAwarded}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: Spacing.three, paddingTop: Spacing.two },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  coinsChip: {
    backgroundColor: "#FAEEDA",
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 999,
  },
  coinsText: { color: "#633806" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.four },
  scoreCard: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.three },
  statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusPill: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.half, borderRadius: 999 },
  statusText: { color: "#ffffff" },
  scoreRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  team: { flex: 1, fontSize: 20, lineHeight: 26 },
  score: { fontSize: 36, lineHeight: 40, paddingHorizontal: Spacing.three },
  feed: { flex: 1 },
  feedContent: { gap: Spacing.half },
  eventWrap: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: Spacing.two },
  eventRow: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  eventMinute: { width: 28 },
  eventIcon: { width: 22, textAlign: "center" },
  watch: { marginLeft: "auto" },
  fallback: {
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
  fallbackCard: { borderRadius: Spacing.three, padding: Spacing.four, gap: Spacing.two, alignItems: "center" },
});
