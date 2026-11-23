import { describe, expect, it } from 'vitest';
import {
  mapAdminError,
  mapAuthError,
  mapBookingError,
  mapPersonalOtpError,
  SLOT_ALREADY_BOOKED,
  SLOT_BLOCKED,
} from './bookingApi';

describe('mapBookingError', () => {
  it('maps DB double-booking errors to Hebrew', () => {
    expect(mapBookingError({ message: SLOT_ALREADY_BOOKED })).toMatch(/הזמנה פעילה|משמרת/);
    expect(mapBookingError({ message: `ERROR: ${SLOT_BLOCKED}` })).toMatch(/חסום/);
    expect(mapBookingError({ message: 'invalid_shift' })).toMatch(/משמרת תקינה/);
  });

  it('maps RAISE MESSAGE bug and API/auth/RLS/network edge cases', () => {
    expect(mapBookingError({ message: 'RAISE option already specified: MESSAGE' })).toMatch(/משבצת|תאריך/);
    expect(mapBookingError({ message: 'Invalid API key', code: 'UNAUTHORIZED_INVALID_API_KEY' })).toMatch(
      /חיבור למערכת/,
    );
    expect(mapBookingError({ message: 'JWT expired' })).toMatch(/פג תוקף/);
    expect(mapBookingError({ message: 'new row violates row-level security policy' })).toMatch(/אין הרשאה/);
    expect(mapBookingError({ message: 'Failed to fetch', name: 'TypeError' })).toMatch(/חיבור|אינטרנט/);
    expect(mapBookingError({ code: '23505', message: 'duplicate key value' })).toMatch(/כבר בוצעה/);
    expect(mapBookingError({ code: '22P02', message: 'invalid input syntax' })).toMatch(/לא תקינים/);
  });

  it('hides technical jargon and uses a calm fallback', () => {
    expect(mapBookingError({ message: 'P0001' })).toMatch(/השתבש/);
    expect(mapBookingError({})).toMatch(/השתבש/);
    expect(mapBookingError({ message: 'network down' })).toBe('network down');
  });
});

describe('mapAuthError', () => {
  it('maps invalid credentials and API key failures', () => {
    expect(mapAuthError({ message: 'Invalid login credentials' })).toMatch(/דואר|סיסמה/);
    expect(mapAuthError({ message: 'Invalid API key' })).toMatch(/חיבור למערכת/);
    expect(mapAuthError({ message: 'Request rate limit reached' })).toMatch(/יותר מדי/);
  });
});

describe('mapAdminError', () => {
  it('reuses booking mappings and custom fallbacks', () => {
    expect(mapAdminError({ message: SLOT_ALREADY_BOOKED })).toMatch(/הזמנה פעילה|משמרת/);
    expect(mapAdminError({}, 'טעינה נכשלה')).toBe('טעינה נכשלה');
  });
});

describe('mapPersonalOtpError', () => {
  it('maps phone provider not configured without swallowing Twilio send errors', () => {
    expect(mapPersonalOtpError({ message: 'Phone logins are disabled' })).toMatch(/SMS|סופבייס/);
    expect(mapPersonalOtpError({ message: 'sms provider not configured' })).toMatch(/SMS|סופבייס/);
  });

  it('maps Twilio compliance / send failures clearly', () => {
    expect(
      mapPersonalOtpError({
        code: 'sms_send_failed',
        message: 'Error sending confirmation OTP: 21608 Primary Compliance Profile',
      }),
    ).toMatch(/Twilio|Compliance|Caller/);
    expect(
      mapPersonalOtpError({
        code: 'sms_send_failed',
        message: 'Delivery channel disabled: SMS More information: 60223',
      }),
    ).toMatch(/SMS|Verify|Delivery/);
  });

  it('maps rate limit, invalid OTP, and auth gaps', () => {
    expect(mapPersonalOtpError({ message: 'sms_send_rate_limit' })).toMatch(/יותר מדי/);
    expect(mapPersonalOtpError({ message: 'Token has expired or is invalid' })).toMatch(/קוד שגוי|תוקף/);
    expect(mapPersonalOtpError({ message: 'not_authenticated', code: '42501' })).toMatch(/לאמת/);
  });
});
