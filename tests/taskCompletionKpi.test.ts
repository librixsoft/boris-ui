import { describe, it, expect } from "vitest";
import { taskCompletionKpi, TaskEndMarker } from "../src/main/browser/human/taskCompletionKpi";

describe("taskCompletionKpi", () => {
  it("todo done -> 100%", () => {
    const markers: TaskEndMarker[] = [
      { reason: "done", success: true, roundsUsed: 5, browserActions: 2 },
      { reason: "done", success: true, roundsUsed: 7, browserActions: 3 }
    ];
    const k = taskCompletionKpi(markers);
    expect(k.rate).toBe(100);
    expect(k.n).toBe(2);
  });

  it("mezcla done/maxRounds/error -> tasa correcta", () => {
    const markers: TaskEndMarker[] = [
      { reason: "done", success: true, roundsUsed: 5, browserActions: 2 },
      { reason: "maxRounds", success: false, roundsUsed: 200, browserActions: 10 },
      { reason: "error", success: false, roundsUsed: 8, browserActions: 1 },
      { reason: "aborted", success: false, roundsUsed: 12, browserActions: 4 }
    ];
    const k = taskCompletionKpi(markers);
    expect(k.rate).toBe(25);
    expect(k.byReason.done).toBe(1);
    expect(k.byReason.maxRounds).toBe(1);
    expect(k.n).toBe(4);
  });

  it("sin markers -> 0 y no divide por cero", () => {
    const k = taskCompletionKpi([]);
    expect(k.rate).toBe(0);
    expect(k.n).toBe(0);
    expect(k.avgRounds).toBe(0);
    expect(k.avgRoundsDone).toBe(0);
  });

  it("avgRoundsDone solo cuenta las limpias", () => {
    const markers: TaskEndMarker[] = [
      { reason: "done", success: true, roundsUsed: 4, browserActions: 1 },
      { reason: "maxRounds", success: false, roundsUsed: 200, browserActions: 5 }
    ];
    const k = taskCompletionKpi(markers);
    expect(k.avgRoundsDone).toBe(4);
    expect(k.avgRounds).toBe(102);
  });

  it("byReason cuenta todas las razones", () => {
    const markers: TaskEndMarker[] = [
      { reason: "done", success: true, roundsUsed: 3, browserActions: 1 },
      { reason: "done", success: true, roundsUsed: 5, browserActions: 2 },
      { reason: "aborted", success: false, roundsUsed: 10, browserActions: 3 }
    ];
    const k = taskCompletionKpi(markers);
    expect(k.byReason.done).toBe(2);
    expect(k.byReason.aborted).toBe(1);
    expect(Object.keys(k.byReason).length).toBe(2);
  });

  it("rate es porcentaje correcto con mezcla variada", () => {
    const markers: TaskEndMarker[] = [
      { reason: "done", success: true, roundsUsed: 2, browserActions: 1 },
      { reason: "done", success: true, roundsUsed: 3, browserActions: 1 },
      { reason: "done", success: true, roundsUsed: 4, browserActions: 2 },
      { reason: "error", success: false, roundsUsed: 1, browserActions: 1 },
      { reason: "error", success: false, roundsUsed: 2, browserActions: 1 }
    ];
    const k = taskCompletionKpi(markers);
    expect(k.rate).toBe(60);
    expect(k.n).toBe(5);
  });
});
