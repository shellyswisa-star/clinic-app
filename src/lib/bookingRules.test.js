import { describe, expect, it } from 'vitest';
import {
  bookingHoldsSlot,
  canStartSave,
  findDuplicateActiveBookings,
  isShiftTaken,
  shiftsOverlap,
  validateAdminBookingEdit,
  validateBookingForm,
  HOLD_WINDOW_MS,
} from './bookingRules';

describe('shiftsOverlap', () => {
  it('detects same shift and full-day collisions', () => {
    expect(shiftsOverlap('morning', 'morning')).toBe(true);
    expect(shiftsOverlap('morning', 'afternoon')).toBe(false);
    expect(shiftsOverlap('morning', 'full-day')).toBe(true);
    expect(shiftsOverlap('full-day', 'afternoon')).toBe(true);
  });
});

describe('bookingHoldsSlot', () => {
  const now = new Date('2026-11-19T12:00:00Z');

  it('holds paid bookings', () => {
    expect(bookingHoldsSlot({ status: 'paid' }, now)).toBe(true);
  });

  it('ignores cancelled bookings', () => {
    expect(bookingHoldsSlot({ status: 'cancelled', created_at: now.toISOString() }, now)).toBe(false);
  });

  it('holds only recent reserved bookings for single slots', () => {
    expect(
      bookingHoldsSlot(
        { status: 'reserved', created_at: new Date(now.getTime() - 5 * 60 * 1000).toISOString() },
        now,
      ),
    ).toBe(true);

    expect(
      bookingHoldsSlot(
        { status: 'reserved', created_at: new Date(now.getTime() - HOLD_WINDOW_MS - 1000).toISOString() },
        now,
      ),
    ).toBe(false);
  });

  it('holds reserved series / monthly / session even after hold window', () => {
    const old = new Date(now.getTime() - HOLD_WINDOW_MS - 1000).toISOString();
    expect(bookingHoldsSlot({ status: 'reserved', series_id: 's1', created_at: old }, now)).toBe(true);
    expect(bookingHoldsSlot({ status: 'reserved', plan_id: 'monthly', created_at: old }, now)).toBe(true);
    expect(bookingHoldsSlot({ status: 'reserved', plan_id: 'session', created_at: old }, now)).toBe(true);
  });
});

describe('isShiftTaken / no double booking', () => {
  const now = new Date('2026-11-19T12:00:00Z');

  it('blocks a paid morning shift', () => {
    expect(
      isShiftTaken({
        dateStr: '2026-11-19',
        shiftStr: 'morning',
        existingBookings: [
          {
            selected_date: '2026-11-19',
            selected_shift: 'morning',
            status: 'paid',
          },
        ],
        now,
      }),
    ).toBe(true);
  });

  it('allows afternoon when morning is paid', () => {
    expect(
      isShiftTaken({
        dateStr: '2026-11-19',
        shiftStr: 'afternoon',
        existingBookings: [
          {
            selected_date: '2026-11-19',
            selected_shift: 'morning',
            status: 'paid',
          },
        ],
        now,
      }),
    ).toBe(false);
  });

  it('blocks via admin blocked_slots', () => {
    expect(
      isShiftTaken({
        dateStr: '2026-11-17', // Tuesday
        shiftStr: 'morning',
        blockedSlots: [{ day_index: 2, shift: 'morning' }],
        now,
      }),
    ).toBe(true);
  });

  it('does not treat expired reserved as taken', () => {
    expect(
      isShiftTaken({
        dateStr: '2026-11-19',
        shiftStr: 'morning',
        existingBookings: [
          {
            selected_date: '2026-11-19',
            selected_shift: 'morning',
            status: 'reserved',
            created_at: new Date(now.getTime() - HOLD_WINDOW_MS - 5000).toISOString(),
          },
        ],
        now,
      }),
    ).toBe(false);
  });
});

describe('findDuplicateActiveBookings', () => {
  const now = new Date('2026-11-19T12:00:00Z');

  it('flags two paid bookings on the same slot', () => {
    const dupes = findDuplicateActiveBookings(
      [
        { id: 1, selected_date: '2026-11-19', selected_shift: 'morning', status: 'paid' },
        { id: 2, selected_date: '2026-11-19', selected_shift: 'morning', status: 'paid' },
      ],
      now,
    );
    expect(dupes.length).toBeGreaterThan(0);
  });

  it('flags full-day overlapping a partial shift', () => {
    const dupes = findDuplicateActiveBookings(
      [
        { id: 1, selected_date: '2026-11-19', selected_shift: 'full-day', status: 'paid' },
        { id: 2, selected_date: '2026-11-19', selected_shift: 'morning', status: 'paid' },
      ],
      now,
    );
    expect(dupes.some((d) => d.key.includes('full-day-overlap'))).toBe(true);
  });
});

describe('validateBookingForm', () => {
  it('rejects empty / invalid fields', () => {
    expect(validateBookingForm({ name: '', phone: '' }).ok).toBe(false);
    expect(validateBookingForm({ name: 'א', phone: '0501234567' }).ok).toBe(false);
    expect(validateBookingForm({ name: 'שלי', phone: '123' }).ok).toBe(false);
  });

  it('accepts valid Israeli mobile', () => {
    expect(validateBookingForm({ name: 'שלי סוויסה', phone: '050-1234567' }).ok).toBe(true);
  });
});

describe('validateAdminBookingEdit', () => {
  const valid = {
    full_name: 'שלי',
    phone: '0501234567',
    selected_date: '2026-11-10',
    selected_shift: 'full-day',
    total_price: 260,
    status: 'paid',
  };

  it('accepts a complete edit form', () => {
    expect(validateAdminBookingEdit(valid).ok).toBe(true);
  });

  it('requires date for active bookings and valid price/shift/status', () => {
    expect(validateAdminBookingEdit({ ...valid, selected_date: '' }).ok).toBe(false);
    expect(validateAdminBookingEdit({ ...valid, selected_shift: 'evening' }).message).toMatch(/משמרת/);
    expect(validateAdminBookingEdit({ ...valid, total_price: -5 }).message).toMatch(/סכום/);
    expect(validateAdminBookingEdit({ ...valid, status: 'weird' }).message).toMatch(/מצב/);
  });

  it('allows cancelled without date', () => {
    expect(
      validateAdminBookingEdit({ ...valid, status: 'cancelled', selected_date: '' }).ok,
    ).toBe(true);
  });
});

describe('canStartSave / no double charge submit', () => {
  it('blocks concurrent save', () => {
    expect(canStartSave({ isSaving: true })).toBe(false);
    expect(canStartSave({ isSaving: false })).toBe(true);
  });
});
