import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { QUESTIONS } from '../../server/questions';
import { parseGuess, toScaled } from '../../shared/numbers';
import { CATEGORY_IDS, MAX_GUESS_ABS } from '../../shared/protocol';

describe('question bank', () => {
  it('has at least 100 questions with unique ids', () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(100);
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length);
  });

  it('covers every category generously', () => {
    for (const cat of CATEGORY_IDS) {
      const n = QUESTIONS.filter((q) => q.category === cat).length;
      expect(n, cat).toBeGreaterThanOrEqual(15);
    }
    for (const q of QUESTIONS) expect(CATEGORY_IDS).toContain(q.category);
  });

  it('every question is complete and well-formed', () => {
    for (const q of QUESTIONS) {
      expect(q.text.length, q.id).toBeGreaterThan(10);
      expect(q.text.trim().endsWith('?') || q.text.trim().endsWith(')'), q.id).toBe(true);
      expect(Number.isFinite(q.answer), q.id).toBe(true);
      expect(Math.abs(q.answer), q.id).toBeLessThanOrEqual(MAX_GUESS_ABS);
      expect(Number.isInteger(q.precision) && q.precision >= 0 && q.precision <= 2, q.id).toBe(true);
      expect(q.modes.length, q.id).toBeGreaterThan(0);
      expect(q.source.length, q.id).toBeGreaterThan(5);
      expect(typeof q.unit, q.id).toBe('string');
    }
  });

  it('answers fit their precision and are valid guesses themselves', () => {
    for (const q of QUESTIONS) {
      // The answer must be representable exactly at the question's precision.
      expect(toScaled(q.answer, q.precision) / 10 ** q.precision, q.id).toBe(q.answer);
      const parsed = parseGuess(String(q.answer), { precision: q.precision, allowNegative: !!q.allowNegative });
      expect(parsed, q.id).toEqual({ ok: true, value: q.answer });
    }
  });

  it('only allows negatives where the answer can be negative', () => {
    for (const q of QUESTIONS) {
      if (q.answer < 0) expect(q.allowNegative, q.id).toBe(true);
    }
  });

  it('year questions are Closest Overall only', () => {
    for (const q of QUESTIONS.filter((x) => x.unit === 'year')) expect(q.modes, q.id).toEqual(['closest']);
  });

  it('has enough questions for a 20-question game in every mode', () => {
    expect(QUESTIONS.filter((q) => q.modes.includes('closest')).length).toBeGreaterThanOrEqual(20);
    expect(QUESTIONS.filter((q) => q.modes.includes('withoutGoingOver')).length).toBeGreaterThanOrEqual(20);
  });

  it('never states the answer in the question text or hint', () => {
    for (const q of QUESTIONS) {
      if (Math.abs(q.answer) < 10) continue; // tiny numbers appear naturally ("3×3", "one decimal place")
      for (const f of new Set([String(q.answer), q.answer.toLocaleString('en-US')])) {
        const re = new RegExp(`(?<![\\d.,])${f.replace(/[.$]/g, '\\$&')}(?![\\d])`);
        expect(re.test(q.text), `${q.id} text`).toBe(false);
        expect(re.test(q.hint ?? ''), `${q.id} hint`).toBe(false);
      }
    }
  });

  it('is never imported by browser code', () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => {
        const p = join(dir, f);
        return statSync(p).isDirectory() ? walk(p) : [p];
      });
    for (const file of [...walk('client/src'), ...walk('shared')]) {
      const src = readFileSync(file, 'utf8');
      expect(src, file).not.toMatch(/server\/questions|server\/bank/);
    }
  });
});
