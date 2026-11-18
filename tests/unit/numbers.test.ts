import { describe, expect, it } from 'vitest';
import { compactValue, exactDiff, formatSignedDiff, formatValue, parseGuess, toScaled } from '../../shared/numbers';

const whole = { precision: 0, allowNegative: false };
const cents = { precision: 2, allowNegative: false };
const negOk = { precision: 1, allowNegative: true };

function ok(raw: unknown, rules = whole) {
  const r = parseGuess(raw, rules);
  if (!r.ok) throw new Error(`expected ok for ${String(raw)}: ${r.message}`);
  return r.value;
}
function bad(raw: unknown, rules = whole) {
  const r = parseGuess(raw, rules);
  expect(r.ok, `expected rejection for ${String(raw)}`).toBe(false);
  return r.ok ? '' : r.message;
}

describe('parseGuess', () => {
  it('accepts plain, grouped, signed and currency formats', () => {
    expect(ok('42')).toBe(42);
    expect(ok(' 1,234 ')).toBe(1234);
    expect(ok('1 234')).toBe(1234);
    expect(ok('+7')).toBe(7);
    expect(ok('$3.99', cents)).toBe(3.99);
    expect(ok('3.5', cents)).toBe(3.5);
    expect(ok('.5', cents)).toBe(0.5);
    expect(ok('5.', whole)).toBe(5);
    expect(ok('1,234,567.89', cents)).toBe(1234567.89);
    expect(ok(17)).toBe(17);
    expect(ok(0)).toBe(0);
  });

  it('rejects NaN, Infinity and non-numbers', () => {
    for (const raw of [NaN, Infinity, -Infinity, 'NaN', 'Infinity', '-Infinity', '', '   ', 'abc', '12abc', '1e5', '0x10', '--5', '1.2.3', '1,23', null, undefined, {}, [], true]) {
      bad(raw);
    }
  });

  it('rejects disallowed negatives but allows them when the question does', () => {
    expect(bad('-5')).toMatch(/negative/i);
    expect(bad(-5)).toMatch(/negative/i);
    expect(ok('-89.2', negOk)).toBe(-89.2);
    expect(ok('−40', negOk)).toBe(-40); // unicode minus
    expect(ok('-0')).toBe(0);
    expect(Object.is(ok('-0'), -0)).toBe(false);
  });

  it('enforces decimal precision', () => {
    expect(bad('3.5')).toMatch(/whole numbers/i);
    expect(bad('3.999', cents)).toMatch(/2 decimal places/);
    expect(bad(0.1 + 0.2, cents)).toMatch(/decimal/); // 0.30000000000000004
    expect(ok('3.10', cents)).toBe(3.1);
    expect(ok('3.0', whole)).toBe(3); // trailing zeros don't count as decimals
  });

  it('rejects absurdly large or long input', () => {
    expect(bad('1000000000001')).toMatch(/too big/i);
    expect(ok('1000000000000')).toBe(1e12);
    expect(bad('1'.repeat(40))).toMatch(/too long/i);
    expect(bad(1e300)).toBeTruthy();
  });
});

describe('exact arithmetic', () => {
  it('scales decimals to integers without float error', () => {
    expect(toScaled(3.99, 2)).toBe(399);
    expect(toScaled(0.1, 1)).toBe(1);
    expect(toScaled(-89.2, 1)).toBe(-892);
    expect(toScaled(1.005, 2)).toBe(101); // half-up on the dropped digit
    expect(toScaled(8848.86, 2)).toBe(884886);
  });

  it('computes exact differences', () => {
    expect(exactDiff(0.3, 0.1, 1).value).toBe(0.2);
    expect(exactDiff(4, 3.99, 2).value).toBe(0.01);
    expect(exactDiff(3.98, 3.99, 2).scaled).toBe(exactDiff(4, 3.99, 2).scaled);
  });
});

describe('formatting', () => {
  it('formats values with units', () => {
    expect(formatValue(3.99, '$', 2)).toBe('$3.99');
    expect(formatValue(1.5, '$', 2)).toBe('$1.50');
    expect(formatValue(499, '$', 2)).toBe('$499');
    expect(formatValue(7200000, '$', 0)).toBe('$7,200,000');
    expect(formatValue(1889, 'year', 0)).toBe('1889');
    expect(formatValue(1454, 'ft', 0)).toBe('1,454 ft');
    expect(formatValue(-89.2, '°C', 1)).toBe('−89.2°C');
    expect(formatValue(5050, '', 0)).toBe('5,050');
  });

  it('formats signed differences', () => {
    expect(formatSignedDiff(0, 'ft', 0)).toBe('exact!');
    expect(formatSignedDiff(12, 'ft', 0)).toBe('+12 ft');
    expect(formatSignedDiff(-0.5, '$', 2)).toBe('−$0.50');
    expect(formatSignedDiff(-3, 'year', 0)).toBe('−3 yr');
  });

  it('compacts big numbers for crowded labels', () => {
    expect(compactValue(384400, 'km', 0)).toBe('384.4K');
    expect(compactValue(7200000, '$', 0)).toBe('$7.2M');
    expect(compactValue(1889, 'year', 0)).toBe('1889');
    expect(compactValue(42, 'ft', 0)).toBe('42 ft');
  });
});
