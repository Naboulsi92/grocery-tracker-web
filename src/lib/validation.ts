import { isUnit } from '@/types/units';

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

export const UnitErrors = {
  INVALID: 'validation.unit.invalid',
} as const;

export const BuyQuantityErrors = {
  INVALID: 'validation.buy_quantity.invalid',
} as const;

export function validateUnit(value: string): string | null {
  if (!isUnit(value)) return UnitErrors.INVALID;
  return null;
}

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
  // Threshold 0 is valid ("buy only when fully out of stock"); negatives are not.
  if (!Number.isFinite(num) || num < 0 || !Number.isInteger(num)) {
    return ThresholdErrors.REQUIRED;
  }
  return null;
}

export function validateBuyQuantity(raw: string): string | null {
  const value = raw.trim();
  // Ticket #252 : the buy quantity is an optional intention — an empty field
  // means "no intent", never an invalid number.
  if (value === '') return null;
  // Integer-only check on the raw string: Number('2.5') would silently pass a
  // finite-but-fractional intent. '003' stays a valid integer (3).
  if (!/^-?\d+$/.test(value) || Number(value) < 1) {
    return BuyQuantityErrors.INVALID;
  }
  return null;
}
