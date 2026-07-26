import { describe, it, expect } from "vitest";
import { optimizeRoute, buildInitialRoute, twoOptImprove } from "../services/optimizer";
import type { ScoredTask } from "../types";

function task(overrides: Partial<ScoredTask> & { id: string }): ScoredTask {
  return {
    label: overrides.id,
    place_name: overrides.id,
    duration_min: 15,
    time_window: null,
    flexibility: "flexible",
    urgency_score: 50,
    urgency_reason: "test",
    location: { lat: 0, lng: 0 },
    ...overrides,
  };
}

// Square matrix helper: index 0 is always the start location.
function matrixOf(n: number, time: (i: number, j: number) => number): number[][] {
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 0 : time(i, j))));
}

describe("optimizer", () => {
  it("handles a single task with no errors", () => {
    const tasks = [task({ id: "t1", duration_min: 20 })];
    const matrix = matrixOf(2, () => 10);
    const result = optimizeRoute({ tasks, matrix, startLocation: { lat: 0, lng: 0 }, planStartTime: "09:00" });

    expect(result.stops).toHaveLength(1);
    expect(result.stops[0].order_index).toBe(0);
    expect(result.stops[0].arrival_time_estimate).toBe("09:10");
    expect(result.conflicts).toHaveLength(0);
  });

  it("locks fixed tasks in time-window order via buildInitialRoute", () => {
    const t1 = task({ id: "t1", time_window: { start: "14:00", end: "15:00" }, flexibility: "fixed" });
    const t2 = task({ id: "t2", time_window: { start: "10:00", end: "11:00" }, flexibility: "fixed" });
    const t3 = task({ id: "t3" }); // flexible, excluded from initial route

    const initial = buildInitialRoute([t1, t2, t3]);
    expect(initial.map((t) => t.id)).toEqual(["t2", "t1"]);
  });

  it("surfaces a conflict when two fixed windows are impossible to both satisfy", () => {
    const t1 = task({
      id: "t1",
      label: "Dentist",
      time_window: { start: "10:00", end: "10:15" },
      flexibility: "fixed",
      duration_min: 45,
    });
    const t2 = task({
      id: "t2",
      label: "Vet",
      time_window: { start: "10:20", end: "10:30" },
      flexibility: "fixed",
    });

    // Long travel time between the two locations makes both windows unreachable together.
    const matrix = matrixOf(3, () => 60);
    const result = optimizeRoute({
      tasks: [t1, t2],
      matrix,
      startLocation: { lat: 0, lng: 0 },
      planStartTime: "09:00",
    });

    expect(result.conflicts.length).toBeGreaterThan(0);
    expect(result.conflicts.some((c) => c.includes("Vet"))).toBe(true);
  });

  it("inserts a flexible task into the cheapest gap", () => {
    const t1 = task({ id: "t1", time_window: { start: "09:00", end: "09:30" }, flexibility: "fixed" });
    const t2 = task({ id: "t2", time_window: { start: "12:00", end: "12:30" }, flexibility: "fixed" });
    // t3 is much closer to t1's location (index 1) than anywhere else.
    const flexible = task({ id: "t3", urgency_score: 40 });

    // indices: 0=start, 1=t1, 2=t2, 3=t3
    const matrix = matrixOf(4, (i, j) => {
      if ((i === 1 && j === 3) || (i === 3 && j === 1)) return 2; // t1 <-> t3 close
      return 30;
    });

    const result = optimizeRoute({
      tasks: [t1, t2, flexible],
      matrix,
      startLocation: { lat: 0, lng: 0 },
      planStartTime: "08:00",
    });

    const order = result.stops.map((s) => s.id);
    const t1Pos = order.indexOf("t1");
    const t3Pos = order.indexOf("t3");
    expect(Math.abs(t3Pos - t1Pos)).toBe(1);
  });

  it("twoOptImprove never reorders fixed stops", () => {
    const t1 = task({ id: "t1", time_window: { start: "09:00", end: "09:30" }, flexibility: "fixed" });
    const t2 = task({ id: "t2", time_window: { start: "10:00", end: "10:30" }, flexibility: "fixed" });
    const matrix = matrixOf(3, () => 10);
    const taskIndexOf = new Map([
      ["t1", 1],
      ["t2", 2],
    ]);

    const result = twoOptImprove([t1, t2], matrix, taskIndexOf);
    expect(result.map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  it("computes total_duration_min as sum of travel + task durations", () => {
    const t1 = task({ id: "t1", duration_min: 20 });
    const t2 = task({ id: "t2", duration_min: 10 });
    const matrix = matrixOf(3, () => 5);

    const result = optimizeRoute({
      tasks: [t1, t2],
      matrix,
      startLocation: { lat: 0, lng: 0 },
      planStartTime: "09:00",
    });

    // 2 legs * 5 min travel + 30 min task duration = 40
    expect(result.totalDurationMin).toBe(40);
  });
});
