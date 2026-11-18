/**
 * Number parsing, exact decimal arithmetic and display formatting.
 *
 * Shared by the server (authoritative validation and scoring) and the client
 * (instant feedback while typing). All scoring comparisons are done on
 * integers scaled by 10^precision, so 0.1 + 0.2 style float errors can never
 * produce a wrong winner or a false tie.
 */
import { MAX_GUESS_ABS, MAX_GUESS_CHARS } from './protocol';

export type ParseResult = { ok: true; value: number } | { ok: false; message: string };

export interface NumberRules {
  /** Decimal places allowed (0 = whole numbers only). */
  precision: number;
  allowNegative: boolean;
}

const PLAIN_NUMBER = /^([-+]?)(\d+(?:\.\d*)?|\.\d+)$/;
const GROUPED_NUMBER = /^([-+]?)(\d{1,3}(?:,\d{3})+(?:\.\d*)?)$/;

/** Significant digits after the decimal point ("3.10" → 1, "3.0" → 0). */
function decimalsOf(digits: string): number {
  const dot = digits.indexOf('.');
  return dot === -1 ? 0 : digits.slice(dot + 1).replace(/0+$/, '').length;
}

/**
 * Parses a guess typed by a person, or sent by a client.
 *
 * Accepts: `42`, `-3`, `1,234.5`, `$3.99`, ` 7 `, `.5`, `5.`.
 * Rejects: empty, NaN, Infinity, exponent notation, letters, more decimals than
 * allowed, disallowed negatives, and values beyond ±MAX_GUESS_ABS.
 */
export function parseGuess(raw: unknown, rules: NumberRules): ParseResult {
  let text: string;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return { ok: false, message: 'That is not a number.' };
    text = numberToPlainString(raw);
  } else if (typeof raw === 'string') {
    if (raw.length > MAX_GUESS_CHARS) return { ok: false, message: 'That number is too long.' };
    text = raw;
  } else {
    return { ok: false, message: 'Enter a number.' };
  }

  // Strip spaces (incl. thin/nbsp) and a currency sign; normalize the minus sign.
  let s = text.normalize('NFKC').replace(/[\s  ]/g, '').replace(/−/g, '-');
  s = s.replace(/^([-+]?)\$/, '$1');
  if (!s) return { ok: false, message: 'Enter a number.' };

  const m = PLAIN_NUMBER.exec(s) ?? GROUPED_NUMBER.exec(s);
  if (!m) return { ok: false, message: 'Numbers only, please (like 42 or 3.5).' };
  const sign = m[1] === '-' ? -1 : 1;
  const digits = m[2]!.replace(/,/g, '');
  const decimals = decimalsOf(digits);
  if (decimals > rules.precision) {
    return {
      ok: false,
      message:
        rules.precision === 0
          ? 'Whole numbers only for this one.'
          : `Use at most ${rules.precision} decimal place${rules.precision === 1 ? '' : 's'}.`,
    };
  }
  const magnitude = Number(digits.replace(/\.$/, ''));
  if (!Number.isFinite(magnitude)) return { ok: false, message: 'That is not a number.' };
  if (magnitude > MAX_GUESS_ABS) return { ok: false, message: 'Whoa, that number is too big!' };
  const value = sign * magnitude;
  if (value < 0 && !rules.allowNegative) return { ok: false, message: 'No negative numbers for this one.' };
  // Normalize -0 to 0.
  return { ok: true, value: value === 0 ? 0 : value };
}

/** Plain (non-exponent) decimal string for a finite number. */
export function numberToPlainString(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  const s = String(n);
  if (!/e/i.test(s)) return s;
  // Small/large numbers: toFixed handles up to 100 fraction digits.
  const abs = Math.abs(n);
  return abs < 1 ? n.toFixed(20).replace(/0+$/, '').replace(/\.$/, '') : BigInt(Math.round(n)).toString();
}

/** Exact integer representation of `value` in units of 10^-precision. */
export function toScaled(value: number, precision: number): number {
  const s = numberToPlainString(Math.abs(value));
  const [int = '0', frac = ''] = s.split('.');
  const padded = (frac + '0'.repeat(precision)).slice(0, precision);
  // Round half up on the first dropped digit (only reachable for unvalidated input).
  const roundUp = (frac[precision] ?? '0') >= '5' ? 1 : 0;
  const scaled = Number(int + padded) + roundUp;
  return value < 0 ? -scaled : scaled;
}

/** Inverse of toScaled. */
export function fromScaled(scaled: number, precision: number): number {
  return Number((scaled / 10 ** precision).toFixed(precision));
}

/** |a − b| computed exactly at the given precision. */
export function exactDiff(a: number, b: number, precision: number): { scaled: number; value: number } {
  const scaled = Math.abs(toScaled(a, precision) - toScaled(b, precision));
  return { scaled, value: fromScaled(scaled, precision) };
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

/** Units rendered as a prefix (currency). Everything else is a suffix. */
const PREFIX_UNITS = new Set(['$']);
/** Units shown without thousands separators (e.g. 1889, not 1,889). */
const NO_GROUPING_UNITS = new Set(['year']);

export function formatNumber(value: number, precision: number, grouping = true): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: precision > 0 && !Number.isInteger(value) ? precision : 0,
    maximumFractionDigits: precision,
    useGrouping: grouping,
  });
}

/** Human-friendly value with unit, e.g. "$3.99", "1,454 ft", "1889". */
export function formatValue(value: number, unit: string, precision: number): string {
  if (PREFIX_UNITS.has(unit)) {
    const neg = value < 0 ? '−' : '';
    // Currency with cents always shows two digits ($3.50, not $3.5).
    const body = Math.abs(value).toLocaleString('en-US', {
      minimumFractionDigits: precision > 0 && !Number.isInteger(value) ? precision : 0,
      maximumFractionDigits: precision,
    });
    return `${neg}${unit}${body}`;
  }
  const num = formatNumber(value, precision, !NO_GROUPING_UNITS.has(unit)).replace(/^-/, '−');
  if (NO_GROUPING_UNITS.has(unit) || !unit) return num;
  if (unit === '%' || unit === '°F' || unit === '°C') return `${num}${unit}`;
  return `${num} ${unit}`;
}

/** Signed difference for reveal labels, e.g. "+12 ft", "−$0.50", "exact!". */
export function formatSignedDiff(signed: number, unit: string, precision: number): string {
  if (signed === 0) return 'exact!';
  const sign = signed > 0 ? '+' : '−';
  return `${sign}${formatValue(Math.abs(signed), unit === 'year' ? 'yr' : unit, precision)}`;
}

/** The unit when it is short enough for tight labels ($, ft, kg, °F…), else ''. */
export function shortUnit(unit: string): string {
  return unit === '$' || [...unit].length <= 3 ? unit : '';
}

/** Short label for crowded places such as number-line markers: 1.2M, 35K, $4.99. */
export function compactValue(value: number, unit: string, precision: number): string {
  const abs = Math.abs(value);
  if (unit === 'year' || abs < 10_000) return formatValue(value, unit, precision);
  const compact = value.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 });
  if (PREFIX_UNITS.has(unit)) return `${value < 0 ? '−' : ''}${unit}${compact.replace(/^-/, '')}`;
  return compact.replace(/^-/, '−');
}
