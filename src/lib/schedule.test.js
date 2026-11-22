import { describe, expect, it } from 'vitest';
import {
  HOURS_PER_SHIFT,
  SHIFT_WINDOWS,
  formatMonthRangeHe,
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
  it('builds dates from start date for selected weekdays and months', () => {
    // Start Sun 2026-11-22, weekdays Sun(0)+Tue(2), 1 month → until 2026-12-22 exclusive
    const dates = getMonthlyConcreteDates([0, 2], {
      startDateStr: '2026-11-22',
      months: 1,
    });
    expect(dates[0]).toBe('2026-11-22'); // Sunday
    expect(dates).toContain('2026-11-24'); // Tuesday
    expect(dates).toContain('2026-12-20'); // last Sunday before end
    expect(dates).not.toContain('2026-12-22'); // end exclusive
    expect(dates.every((d) => {
      const day = new Date(`${d}T12:00:00`).getDay();
      return day === 0 || day === 2;
    })).toBe(true);
  });

  it('scales with months', () => {
    const one = getMonthlyConcreteDates([1], { startDateStr: '2026-11-23', months: 1 });
    const three = getMonthlyConcreteDates([1], { startDateStr: '2026-11-23', months: 3 });
    expect(three.length).toBeGreaterThan(one.length);
  });

  it('returns empty without start date or weekdays', () => {
    expect(getMonthlyConcreteDates([0, 2], { months: 1 })).toEqual([]);
    expect(getMonthlyConcreteDates([], { startDateStr: '2026-11-22', months: 1 })).toEqual([]);
  });
});

describe('formatMonthRangeHe', () => {
  it('formats an inclusive human range', () => {
    expect(formatMonthRangeHe('2026-11-22', 1)).toMatch(/2026/);
  });
});
