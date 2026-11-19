export interface TaskEndMarker {
  reason: "done" | "maxRounds" | "error" | "aborted";
  success: boolean;
  roundsUsed: number;
  browserActions: number;
}

export interface TaskCompletionKpi {
  rate: number;
  byReason: Record<string, number>;
  avgRounds: number;
  avgRoundsDone: number;
  n: number;
}

export function taskCompletionKpi(markers: TaskEndMarker[]): TaskCompletionKpi {
  const n = markers.length;
  if (n === 0) return { rate: 0, byReason: {}, avgRounds: 0, avgRoundsDone: 0, n: 0 };
  const done = markers.filter((m) => m.success);
  const rate = (done.length / n) * 100;
  const byReason: Record<string, number> = {};
  for (const m of markers) {
    byReason[m.reason] = (byReason[m.reason] ?? 0) + 1;
  }
  const avgRounds = markers.reduce((a, m) => a + m.roundsUsed, 0) / n;
  const avgRoundsDone = done.length
    ? done.reduce((a, m) => a + m.roundsUsed, 0) / done.length
    : 0;
  return { rate, byReason, avgRounds, avgRoundsDone, n };
}
