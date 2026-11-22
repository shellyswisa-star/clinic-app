import { describe, expect, it } from 'vitest';
import {
  mapAdminError,
  mapAuthError,
  mapBookingError,
  SLOT_ALREADY_BOOKED,
  SLOT_BLOCKED,
} from './bookingApi';

describe('mapBookingError', () => {
  it('maps DB double-booking errors to Hebrew', () => {
    expect(mapBookingError({ message: SLOT_ALREADY_BOOKED })).toMatch(/כבר נתפסה/);
    expect(mapBookingError({ message: `ERROR: ${SLOT_BLOCKED}` })).toMatch(/חסומה/);
    expect(mapBookingError({ message: 'invalid_shift' })).toMatch(/משמרת לא תקינה/);
  });

  it('maps API key / auth / RLS / network edge cases', () => {
    expect(mapBookingError({ message: 'Invalid API key', code: 'UNAUTHORIZED_INVALID_API_KEY' })).toMatch(
      /מפתח API/,
    );
    expect(mapBookingError({ message: 'JWT expired' })).toMatch(/פג תוקף/);
    expect(mapBookingError({ message: 'new row violates row-level security policy' })).toMatch(/אין הרשאה/);
    expect(mapBookingError({ message: 'Failed to fetch', name: 'TypeError' })).toMatch(/רשת/);
    expect(mapBookingError({ code: '23505', message: 'duplicate key value' })).toMatch(/כפולה/);
    expect(mapBookingError({ code: '22P02', message: 'invalid input syntax' })).toMatch(/לא תקינים/);
  });

  it('falls back to original message or generic Hebrew', () => {
    expect(mapBookingError({ message: 'network down' })).toBe('network down');
    expect(mapBookingError({})).toMatch(/שגיאה בשמירת ההזמנה/);
  });
});

describe('mapAuthError', () => {
  it('maps invalid credentials and API key failures', () => {
    expect(mapAuthError({ message: 'Invalid login credentials' })).toMatch(/מייל או סיסמה/);
    expect(mapAuthError({ message: 'Invalid API key' })).toMatch(/מפתח API/);
    expect(mapAuthError({ message: 'Request rate limit reached' })).toMatch(/יותר מדי/);
  });
});

describe('mapAdminError', () => {
  it('reuses booking mappings and custom fallbacks', () => {
    expect(mapAdminError({ message: SLOT_ALREADY_BOOKED })).toMatch(/כבר נתפסה/);
    expect(mapAdminError({}, 'טעינה נכשלה')).toBe('טעינה נכשלה');
  });
});
