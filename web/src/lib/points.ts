export type PointsMode = "level" | "rank";

export function getLevelPoints(
  level: { points: number; position: number },
  pointsMode: PointsMode,
  rankPoints: Record<string, number>,
): number {
  if (pointsMode === "rank") {
    const v = rankPoints[String(level.position)];
    return typeof v === "number" ? v : 0;
  }
  return level.points;
}

export type ActiveLevelForPoints = {
  id: string;
  position: number;
  points: number;
  verifier_id: string | null;
};

export type LegacyLevelForPoints = {
  id: string;
  points: number; // frozen at the moment it fell off
  verifier_id: string | null;
};

// Mirrors the prototype's computeListPoints: a player earns a level's
// current points once per victory, and separately again if they're its
// verifier — summed, never cached, so an edit to a level's points (or its
// rank's points) is reflected the next time this runs.
export function computeStandings(
  levels: ActiveLevelForPoints[],
  legacyLevels: LegacyLevelForPoints[],
  victorsByLevel: Map<string, string[]>,
  legacyVictorsByLevel: Map<string, string[]>,
  pointsMode: PointsMode,
  rankPoints: Record<string, number>,
): Map<string, number> {
  const totals = new Map<string, number>();
  const add = (userId: string | null, amount: number) => {
    if (!userId) return;
    totals.set(userId, Math.round(((totals.get(userId) ?? 0) + amount) * 100) / 100);
  };

  for (const level of levels) {
    const pts = getLevelPoints(level, pointsMode, rankPoints);
    for (const userId of victorsByLevel.get(level.id) ?? []) add(userId, pts);
    add(level.verifier_id, pts);
  }
  for (const level of legacyLevels) {
    for (const userId of legacyVictorsByLevel.get(level.id) ?? []) add(userId, level.points);
    add(level.verifier_id, level.points);
  }

  return totals;
}
