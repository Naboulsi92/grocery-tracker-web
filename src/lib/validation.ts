const MAX_NAME_LENGTH = 50;

export const LETTER_PATTERN = /[A-Za-zÀ-ÖØ-öø-ÿ\u0152\u0153]/;

export const NameErrors = {
  REQUIRED_LETTER: 'validation.name.required_letter',
  TOO_LONG: 'validation.name.too_long',
} as const;

export const QuantityErrors = {
  NEGATIVE: 'validation.quantity.positive',
} as const;

export const ThresholdErrors = {
  REQUIRED: 'validation.threshold.required',
} as const;

export function validateName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return NameErrors.REQUIRED_LETTER;
  if (!LETTER_PATTERN.test(trimmed)) return NameErrors.REQUIRED_LETTER;
  if (trimmed.length > MAX_NAME_LENGTH) return NameErrors.TOO_LONG;
  return null;
}

export function validateQuantity(v: string | number): string | null {
  const num = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(num) || num < 0 || !Number.isInteger(num)) {
    return QuantityErrors.NEGATIVE;
  }
  return null;
}

export function validateThreshold(v: string | number): string | null {
  const num = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(num) || num <= 0 || !Number.isInteger(num)) {
    return ThresholdErrors.REQUIRED;
  }
  return null;
}
