export type ScaledAmount = {
  text: string;
  approximate: boolean;
  unconverted: boolean;
  preserved: boolean;
};

const DECIMAL = /^\d+(?:\.\d+)?$/;

export function scaleIngredientAmount(
  amount: string | null,
  scaleWithServings: boolean,
  recipeServings: number,
  targetServings: number,
): ScaledAmount {
  const original = amount?.trim() ?? '';
  if (!original || recipeServings === targetServings) {
    return { text: original, approximate: false, unconverted: false, preserved: false };
  }
  if (!scaleWithServings || !DECIMAL.test(original)) {
    return { text: original, approximate: false, unconverted: false, preserved: true };
  }
  const [whole = '', fraction = ''] = original.split('.');
  const digits = `${whole}${fraction}`;
  if (digits.length > 50) {
    return { text: original, approximate: false, unconverted: true, preserved: false };
  }
  const source = BigInt(digits);
  const numerator = source * BigInt(targetServings) * 100n;
  const denominator = 10n ** BigInt(fraction.length) * BigInt(recipeServings);
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  const rounded = quotient + (remainder * 2n >= denominator ? 1n : 0n);
  if (rounded === 0n && source > 0n) {
    return { text: '少于0.01', approximate: true, unconverted: false, preserved: false };
  }
  const decimal = rounded % 100n;
  const decimalText = String(decimal).padStart(2, '0').replace(/0+$/, '');
  return {
    text: decimalText ? `${rounded / 100n}.${decimalText}` : String(rounded / 100n),
    approximate: remainder !== 0n,
    unconverted: false,
    preserved: false,
  };
}

export function recipeTotalMinutes(
  prepMinutes: number | null,
  cookMinutes: number | null,
): number | null {
  return prepMinutes === null || cookMinutes === null ? null : prepMinutes + cookMinutes;
}
