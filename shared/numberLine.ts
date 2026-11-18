/**
 * Pure layout for the TV number line: where each guess (and the answer) sits,
 * and how markers stack when they would overlap.
 *
 * - Identical values merge into one marker (a tie shows as one pin with several avatars).
 * - Close values are spread over several lanes so labels never sit on top of each other.
 * - When values span several orders of magnitude (e.g. 3 vs 2,000,000) the line switches
 *   to a log scale so the small guesses aren't all crushed into one pixel.
 */

export interface LineItem {
  id: string;
  value: number;
}

export interface LineMarker {
  value: number;
  ids: string[];
  /** Position along the line, 0–100. */
  pct: number;
  /** 0 = closest to the line. */
  lane: number;
}

export interface LineLayout {
  scale: 'linear' | 'log';
  min: number;
  max: number;
  markers: LineMarker[];
  answerPct: number | null;
  ticks: { value: number; pct: number }[];
  lanes: number;
}

export interface LayoutOptions {
  /** Minimum horizontal distance between markers in the same lane (percent of width). */
  minGapPct?: number;
  maxLanes?: number;
  /** Empty space at both ends of the line (percent of width). */
  paddingPct?: number;
}

/** Use a log scale for non-negative data spanning more than this ratio… */
export const LOG_SCALE_RATIO = 100;

/**
 * …and only when a linear scale would crush most of the values into the first
 * few percent of the line (e.g. 3, 5, 10 and 2,000,000).
 */
function shouldUseLog(values: number[], lo: number, hi: number): boolean {
  if (lo < 0 || values.length < 3) return false;
  if ((hi + 1) / (lo + 1) < LOG_SCALE_RATIO) return false;
  const crushed = values.filter((v) => (v - lo) / (hi - lo) < 0.05).length;
  return crushed >= Math.ceil(values.length / 2);
}

function niceStep(range: number, targetTicks: number): number {
  const rough = range / Math.max(1, targetTicks);
  const pow = 10 ** Math.floor(Math.log10(rough));
  const f = rough / pow;
  const nice = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10;
  return nice * pow;
}

export function layoutNumberLine(items: readonly LineItem[], answer: number | null, opts: LayoutOptions = {}): LineLayout {
  const minGap = opts.minGapPct ?? 7;
  const maxLanes = opts.maxLanes ?? 4;
  const padding = opts.paddingPct ?? 6;

  const values = items.map((i) => i.value).filter(Number.isFinite);
  if (answer !== null && Number.isFinite(answer)) values.push(answer);
  let lo = values.length ? Math.min(...values) : 0;
  let hi = values.length ? Math.max(...values) : 1;

  const useLog = shouldUseLog(values, lo, hi);
  const t = useLog ? (v: number) => Math.log10(v + 1) : (v: number) => v;

  let tlo = t(lo);
  let thi = t(hi);
  if (thi - tlo === 0) {
    // All the same value: centre it.
    const pad = useLog ? 0.5 : Math.max(1, Math.abs(lo) * 0.25);
    tlo -= pad;
    thi += pad;
    if (!useLog) {
      lo -= pad;
      hi += pad;
    }
  }
  const span = thi - tlo;
  const pctOf = (v: number) => {
    const raw = padding + ((t(v) - tlo) / span) * (100 - 2 * padding);
    return Math.max(0, Math.min(100, raw));
  };

  // Merge identical values.
  const groups = new Map<number, string[]>();
  for (const item of items) {
    if (!Number.isFinite(item.value)) continue;
    const list = groups.get(item.value) ?? [];
    list.push(item.id);
    groups.set(item.value, list);
  }
  const sorted = [...groups.entries()].sort((a, b) => a[0] - b[0]);

  const lastInLane: number[] = [];
  const markers: LineMarker[] = sorted.map(([value, ids]) => {
    const pct = pctOf(value);
    let lane = -1;
    for (let l = 0; l < maxLanes; l++) {
      const last = lastInLane[l];
      if (last === undefined || pct - last >= minGap) {
        lane = l;
        break;
      }
    }
    if (lane === -1) {
      // Everything is crowded: reuse the lane whose last marker is furthest away.
      lane = lastInLane.reduce((best, v, l) => (v < lastInLane[best]! ? l : best), 0);
    }
    lastInLane[lane] = pct;
    return { value, ids, pct, lane };
  });

  const ticks: { value: number; pct: number }[] = [];
  if (useLog) {
    for (let e = 0; e <= 15; e++) {
      const v = 10 ** e;
      if (v >= lo && v <= hi) ticks.push({ value: v, pct: pctOf(v) });
    }
    if (lo === 0) ticks.unshift({ value: 0, pct: pctOf(0) });
  } else {
    const step = niceStep(hi - lo, 5);
    if (step > 0 && Number.isFinite(step)) {
      for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9 && ticks.length < 12; v += step) {
        const clean = Number(v.toPrecision(12));
        ticks.push({ value: clean, pct: pctOf(clean) });
      }
    }
  }

  return {
    scale: useLog ? 'log' : 'linear',
    min: lo,
    max: hi,
    markers,
    answerPct: answer !== null && Number.isFinite(answer) ? pctOf(answer) : null,
    ticks,
    lanes: Math.max(1, ...markers.map((m) => m.lane + 1)),
  };
}
