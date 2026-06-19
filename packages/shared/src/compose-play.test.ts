import { describe, it, expect } from "vitest";
import { composePlayScript } from "./compose-play.ts";
import { PlayScriptSchema, PITCH_LENGTH } from "./play-script.ts";
import { samplePlay } from "./play-sampler.ts";

describe("composePlayScript", () => {
  it("produces a schema-valid PlayScript", () => {
    const script = composePlayScript({ providerEventId: "wc2026-m1-home-g0", team: "home", scorerShirt: 9 });
    expect(() => PlayScriptSchema.parse(script)).not.toThrow();
    expect(script.actors.find((a) => a.role === "scorer")?.shirtNumber).toBe(9);
  });

  it("is deterministic — same event yields the identical script", () => {
    const a = composePlayScript({ providerEventId: "wc2026-m5-away-g1", team: "away" });
    const b = composePlayScript({ providerEventId: "wc2026-m5-away-g1", team: "away" });
    expect(a).toEqual(b);
  });

  it("varies the template by event id", () => {
    const ids = ["a", "b", "c", "d", "e", "f", "g", "h"].map(
      (s) => composePlayScript({ providerEventId: s, team: "home" }).goalType,
    );
    expect(new Set(ids).size).toBeGreaterThan(1);
  });

  it("ends in a goal and reaches the attacking goal line", () => {
    const home = composePlayScript({ providerEventId: "x", team: "home" });
    const last = home.keyframes[home.keyframes.length - 1]!;
    expect(last.event).toBe("goal");
    expect(samplePlay(home, 1).ball.x).toBeGreaterThan(PITCH_LENGTH - 10);
  });

  it("mirrors direction for the away side (attacks toward x≈0)", () => {
    const away = composePlayScript({ providerEventId: "x", team: "away" });
    expect(away.attackingSide).toBe("away");
    expect(samplePlay(away, 1).ball.x).toBeLessThan(10);
  });
});
