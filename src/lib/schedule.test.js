import { describe, expect, it } from 'vitest';
import {
  HOURS_PER_SHIFT,
  SHIFT_WINDOWS,
  getMonthlyConcreteDates,
  getSessionDates,
} from './schedule';

describe('schedule windows', () => {
  it('defines 6-hour shifts starting at 08:00', () => {
    expect(HOURS_PER_SHIFT).toBe(6);
    expect(SHIFT_WINDOWS.morning.label).toMatch(/08:00/);
    expect(SHIFT_WINDOWS.afternoon.label).toMatch(/14:00/);
  });
});

describe('getSessionDates', () => {
  it('returns 4 weekly dates', () => {
    expect(getSessionDates('2026-11-23')).toEqual([
      '2026-11-23',
      '2026-11-30',
      '2026-12-07',
      '2026-12-14',
    ]);
  });
});

describe('getMonthlyConcreteDates', () => {
  it('expands selected weekdays into concrete calendar dates', () => {
    const from = new Date(2026, 10, 22); // Sun Nov 22 2026 → מתחילים ממחר
    const dates = getMonthlyConcreteDates([0, 2], { weeks: 2, fromDate: from });
    // שני הקרובים: ג׳ 24/11, א׳ 29/11 ואז שבוע אחרי
    expect(dates).toEqual(['2026-11-24', '2026-11-29', '2026-12-01', '2026-12-06']);
  });

  it('returns empty when no weekdays selected', () => {
    expect(getMonthlyConcreteDates([])).toEqual([]);
  });
});
