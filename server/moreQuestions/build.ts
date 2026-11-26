/**
 * Compact row format for the extended question bank.
 *
 * SERVER-ONLY, like `server/questions.ts`.
 *
 *   [text, answer, unit, source, extra?]
 *
 * Defaults (override in `extra`):
 *  - precision: "$" amounts under $1,000 allow cents (2); otherwise the answer's own decimal places;
 *  - modes: "year" questions and negative answers are Closest Overall only; everything else plays both modes;
 *  - allowNegative: only when the answer is negative.
 *
 * Ids are the category prefix plus the row's position, so only ever APPEND rows
 * to a list — reordering would change ids.
 */
import type { CategoryId, ScoringMode } from '../../shared/protocol';
import type { Question } from '../questions';

export interface RowExtra {
  /** Decimal places allowed in guesses. */
  p?: number;
  hint?: string;
  fact?: string;
  modes?: ScoringMode[];
}

export type Row = [text: string, answer: number, unit: string, source: string, extra?: RowExtra];

function decimals(n: number): number {
  const s = String(n);
  const dot = s.indexOf('.');
  return dot === -1 ? 0 : s.length - dot - 1;
}

export function buildQuestions(category: CategoryId, prefix: string, rows: readonly Row[]): Question[] {
  return rows.map(([text, answer, unit, source, extra = {}], i) => {
    const precision = extra.p ?? (unit === '$' && Math.abs(answer) < 1000 ? 2 : decimals(answer));
    const closestOnly = unit === 'year' || answer < 0;
    const q: Question = {
      id: `${prefix}${String(i + 1).padStart(3, '0')}`,
      category,
      text,
      answer,
      unit,
      precision,
      modes: extra.modes ?? (closestOnly ? ['closest'] : ['closest', 'withoutGoingOver']),
      source,
    };
    if (extra.hint) q.hint = extra.hint;
    if (extra.fact) q.fact = extra.fact;
    if (answer < 0) q.allowNegative = true;
    return q;
  });
}
