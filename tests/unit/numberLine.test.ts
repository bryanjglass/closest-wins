import { describe, expect, it } from 'vitest';
import { layoutNumberLine } from '../../shared/numberLine';

describe('number line layout', () => {
  it('places values proportionally on a linear scale', () => {
    const l = layoutNumberLine(
      [
        { id: 'a', value: 0 },
        { id: 'b', value: 50 },
        { id: 'c', value: 100 },
      ],
      null,
      { paddingPct: 0 },
    );
    expect(l.scale).toBe('linear');
    expect(l.markers.map((m) => m.pct)).toEqual([0, 50, 100]);
    expect(l.markers.every((m) => m.lane === 0)).toBe(true);
    expect(l.ticks.length).toBeGreaterThan(2);
  });

  it('merges identical guesses into one marker', () => {
    const l = layoutNumberLine(
      [
        { id: 'a', value: 7 },
        { id: 'b', value: 7 },
        { id: 'c', value: 9 },
      ],
      8,
    );
    expect(l.markers).toHaveLength(2);
    expect(l.markers[0]!.ids).toEqual(['a', 'b']);
    expect(l.answerPct).not.toBeNull();
  });

  it('stacks overlapping markers into separate lanes', () => {
    const items = [100, 101, 102, 103, 500].map((value, i) => ({ id: `p${i}`, value }));
    const l = layoutNumberLine(items, null, { minGapPct: 7, maxLanes: 4 });
    const lanes = l.markers.slice(0, 4).map((m) => m.lane);
    expect(new Set(lanes).size).toBe(4); // four crowded markers, four lanes
    expect(l.markers[4]!.lane).toBe(0); // the far one goes back to lane 0
    expect(l.lanes).toBe(4);
  });

  it('never exceeds the lane limit, even when everything overlaps', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, value: 1000 + i }));
    const l = layoutNumberLine(items, 1_000_000, { maxLanes: 3 });
    expect(Math.max(...l.markers.map((m) => m.lane))).toBeLessThan(3);
  });

  it('switches to a log scale for extreme ranges so small values stay apart', () => {
    const l = layoutNumberLine(
      [
        { id: 'a', value: 3 },
        { id: 'b', value: 5 },
        { id: 'c', value: 2_000_000 },
      ],
      10,
    );
    expect(l.scale).toBe('log');
    const [a, b] = l.markers;
    expect(b!.pct - a!.pct).toBeGreaterThan(2);
    expect(l.ticks.some((t) => t.value === 1000)).toBe(true);
  });

  it('keeps every position within 0–100 and handles a single value', () => {
    const l = layoutNumberLine([{ id: 'a', value: 42 }], 42);
    expect(l.markers[0]!.pct).toBeCloseTo(50);
    expect(l.answerPct).toBeCloseTo(50);
    const empty = layoutNumberLine([], null);
    expect(empty.markers).toEqual([]);
  });

  it('handles negative values on a linear scale', () => {
    const l = layoutNumberLine(
      [
        { id: 'a', value: -90 },
        { id: 'b', value: 10 },
      ],
      -89.2,
    );
    expect(l.scale).toBe('linear');
    for (const m of l.markers) expect(m.pct).toBeGreaterThanOrEqual(0);
    expect(l.answerPct!).toBeLessThan(l.markers[1]!.pct);
  });
});
