import {
  validateName,
  validateQuantity,
  validateThreshold,
  NameErrors,
  QuantityErrors,
  ThresholdErrors,
} from '@/lib/validation';

describe('validateName', () => {
  it('returns error for empty string', () => {
    expect(validateName('')).toBe(NameErrors.REQUIRED_LETTER);
  });

  it('returns error for whitespace-only string', () => {
    expect(validateName('   ')).toBe(NameErrors.REQUIRED_LETTER);
  });

  it('returns error for numbers only', () => {
    expect(validateName('123')).toBe(NameErrors.REQUIRED_LETTER);
  });

  it('returns error for symbols only', () => {
    expect(validateName('!@#$%')).toBe(NameErrors.REQUIRED_LETTER);
  });

  it('returns error for string exceeding 50 chars', () => {
    expect(validateName('a'.repeat(51))).toBe(NameErrors.TOO_LONG);
  });

  it('accepts a single letter', () => {
    expect(validateName('a')).toBeNull();
  });

  it('accepts accented French characters', () => {
    expect(validateName('Émilie François')).toBeNull();
  });

  it('accepts œ and Œ', () => {
    expect(validateName('Œuf')).toBeNull();
  });

  it('accepts 50-character name', () => {
    expect(validateName('a'.repeat(50))).toBeNull();
  });

  it('trims before checking length', () => {
    expect(validateName('  ' + 'a'.repeat(50) + '  ')).toBeNull();
  });

  it('accepts mixed letters and numbers', () => {
    expect(validateName('Coca-Cola 2L')).toBeNull();
  });
});

describe('validateQuantity', () => {
  it('returns error for negative number', () => {
    expect(validateQuantity(-1)).toBe(QuantityErrors.NEGATIVE);
  });

  it('returns error for decimal string', () => {
    expect(validateQuantity('1.5')).toBe(QuantityErrors.NEGATIVE);
  });

  it('returns error for non-numeric string', () => {
    expect(validateQuantity('abc')).toBe(QuantityErrors.NEGATIVE);
  });

  it('accepts zero', () => {
    expect(validateQuantity('0')).toBeNull();
  });

  it('accepts positive integer', () => {
    expect(validateQuantity('5')).toBeNull();
  });

  it('accepts positive integer as number', () => {
    expect(validateQuantity(3)).toBeNull();
  });

  it('accepts zero as number', () => {
    expect(validateQuantity(0)).toBeNull();
  });
});

describe('validateThreshold', () => {
  it('returns error for zero', () => {
    expect(validateThreshold('0')).toBe(ThresholdErrors.REQUIRED);
  });

  it('returns error for negative', () => {
    expect(validateThreshold(-1)).toBe(ThresholdErrors.REQUIRED);
  });

  it('returns error for decimal', () => {
    expect(validateThreshold('1.5')).toBe(ThresholdErrors.REQUIRED);
  });

  it('returns error for non-numeric string', () => {
    expect(validateThreshold('abc')).toBe(ThresholdErrors.REQUIRED);
  });

  it('accepts 1', () => {
    expect(validateThreshold('1')).toBeNull();
  });

  it('accepts large integer', () => {
    expect(validateThreshold(100)).toBeNull();
  });
});
