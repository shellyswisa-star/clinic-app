import { describe, expect, it } from 'vitest';
import { normalizePhoneDigits, phonesMatch } from './phone';

describe('normalizePhoneDigits', () => {
  it('strips formatting and maps 972 to local 0', () => {
    expect(normalizePhoneDigits('050-1234567')).toBe('0501234567');
    expect(normalizePhoneDigits('+972501234567')).toBe('0501234567');
    expect(normalizePhoneDigits('972-52-222-4210')).toBe('0522224210');
  });
});

describe('phonesMatch', () => {
  it('matches equivalent formats', () => {
    expect(phonesMatch('0501234567', '050-123-4567')).toBe(true);
    expect(phonesMatch('+972501234567', '0501234567')).toBe(true);
    expect(phonesMatch('0501111111', '0502222222')).toBe(false);
  });
});
