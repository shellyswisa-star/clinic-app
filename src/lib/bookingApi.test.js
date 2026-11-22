import { describe, expect, it } from 'vitest';
import { mapBookingError, SLOT_ALREADY_BOOKED, SLOT_BLOCKED } from './bookingApi';

describe('mapBookingError', () => {
  it('maps DB double-booking errors to Hebrew', () => {
    expect(mapBookingError({ message: SLOT_ALREADY_BOOKED })).toMatch(/כבר נתפסה/);
    expect(mapBookingError({ message: `ERROR: ${SLOT_BLOCKED}` })).toMatch(/חסומה/);
  });

  it('falls back to original message', () => {
    expect(mapBookingError({ message: 'network down' })).toBe('network down');
  });
});
