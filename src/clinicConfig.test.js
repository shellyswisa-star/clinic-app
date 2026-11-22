import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PRICING,
  buildPlans,
  calcPlanTotal,
  hourlyShiftTotal,
  isSlotBlocked,
  pricingMap,
} from './clinicConfig';
import { HOURS_PER_SHIFT } from './lib/schedule';

describe('pricing correctness', () => {
  it('maps default pricing without duplicates', () => {
    const map = pricingMap(DEFAULT_PRICING);
    const ids = DEFAULT_PRICING.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(map.session).toBe(800);
    expect(map.hourly).toBe(60);
    expect(map.hourly_shift).toBe(60 * HOURS_PER_SHIFT);
  });

  it('charges hourly as rate × shift hours (not stale hourly_shift)', () => {
    expect(HOURS_PER_SHIFT).toBe(6);
    expect(hourlyShiftTotal(DEFAULT_PRICING)).toBe(360);
    expect(calcPlanTotal('hourly', DEFAULT_PRICING)).toBe(360);
    expect(calcPlanTotal('session', DEFAULT_PRICING)).toBe(800);
    expect(calcPlanTotal('monthly', DEFAULT_PRICING, { subPlanDays: 4 })).toBe(2800);

    // גם אם hourly_shift ישן נשאר ב־DB — החיוב נגזר מהשעה
    const stale = DEFAULT_PRICING.map((row) =>
      row.id === 'hourly_shift' ? { ...row, amount: 260 } : row,
    );
    expect(calcPlanTotal('hourly', stale)).toBe(360);
  });

  it('builds plan cards with matching display amounts', () => {
    const plans = buildPlans(DEFAULT_PRICING);
    const hourly = plans.find((p) => p.id === 'hourly');
    const session = plans.find((p) => p.id === 'session');
    expect(hourly.priceDisplay).toContain('60');
    expect(hourly.priceHint).toMatch(/360/);
    expect(session.priceDisplay).toContain('800');
    expect(plans).toHaveLength(4);
  });

  it('uses DB overrides when provided', () => {
    const custom = DEFAULT_PRICING.map((row) =>
      row.id === 'session' ? { ...row, amount: 900 } : row,
    );
    expect(calcPlanTotal('session', custom)).toBe(900);
    expect(buildPlans(custom).find((p) => p.id === 'session').price).toBe(900);
  });
});

describe('blocked slots', () => {
  it('matches recurring weekday and specific date', () => {
    expect(
      isSlotBlocked([{ day_index: 2, shift: 'morning' }], { dayIndex: 2, shift: 'morning' }),
    ).toBe(true);

    expect(
      isSlotBlocked(
        [{ blocked_date: '2026-11-20', shift: 'afternoon' }],
        { dateStr: '2026-11-20', shift: 'afternoon' },
      ),
    ).toBe(true);

    expect(
      isSlotBlocked(
        [{ blocked_date: '2026-11-20', shift: 'afternoon' }],
        { dateStr: '2026-11-21', shift: 'afternoon' },
      ),
    ).toBe(false);
  });
});
