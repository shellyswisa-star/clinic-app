import { describe, expect, it } from 'vitest';
import { normalizePhoneDigits, phonesMatch, toE164Israel } from './phone';

describe('normalizePhoneDigits', () => {
  it('strips formatting and maps 972 to local 0', () => {
    expect(normalizePhoneDigits('050-1234567')).toBe('0501234567');
    expect(normalizePhoneDigits('+972501234567')).toBe('0501234567');
    expect(normalizePhoneDigits('972-52-222-4210')).toBe('0522224210');
  });
});

describe('toE164Israel', () => {
  it('converts local Israeli mobiles to +972', () => {
    expect(toE164Israel('0501234567')).toBe('+972501234567');
    expect(toE164Israel('050-123-4567')).toBe('+972501234567');
    expect(toE164Israel('+972521111111')).toBe('+972521111111');
  });
});

describe('phonesMatch', () => {
  it('matches equivalent formats', () => {
    expect(phonesMatch('0501234567', '050-123-4567')).toBe(true);
    expect(phonesMatch('+972501234567', '0501234567')).toBe(true);
    expect(phonesMatch('0501111111', '0502222222')).toBe(false);
  });
});
