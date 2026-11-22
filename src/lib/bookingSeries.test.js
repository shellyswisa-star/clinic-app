import { describe, expect, it } from 'vitest';
import {
  buildSeriesLabel,
  findSeriesMembers,
  groupBookingsForList,
  summarizeSeries,
} from './bookingSeries';

describe('buildSeriesLabel', () => {
  it('builds monthly label with duration and count', () => {
    const label = buildSeriesLabel({
      planId: 'monthly',
      weekdays: [0, 2],
      shift: 'afternoon',
      startDateStr: '2027-05-01',
      months: 6,
      dates: ['2027-05-02', '2027-05-04', '2027-11-01'],
    });
    expect(label).toContain('השכרה חודשית קבועה');
    expect(label).toContain('יום ראשון');
    expect(label).toContain('יום שלישי');
    expect(label).toContain('אחה״צ');
    expect(label).toContain('6 חודשים');
    expect(label).toContain('3 מועדים');
  });

  it('builds session label from dates range', () => {
    const label = buildSeriesLabel({
      planId: 'session',
      shift: 'morning',
      dates: ['2027-01-04', '2027-01-11', '2027-01-18'],
    });
    expect(label).toContain('מפגש שבועי');
    expect(label).toContain('בוקר');
    expect(label).toContain('3 מועדים');
  });
});

describe('findSeriesMembers', () => {
  const base = {
    id: 'a',
    phone: '0500000000',
    plan_id: 'monthly',
    selected_shift: 'afternoon',
    created_at: '2026-11-22T10:00:00.000Z',
    selected_date: '2027-05-23',
  };

  it('groups by series_id when present', () => {
    const all = [
      { ...base, id: 'a', series_id: 's1', selected_date: '2027-05-23' },
      { ...base, id: 'b', series_id: 's1', selected_date: '2027-05-30' },
      { ...base, id: 'c', series_id: 'other', selected_date: '2027-06-01' },
    ];
    const members = findSeriesMembers(all[0], all);
    expect(members.map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('falls back to phone+plan+shift within 3 minutes', () => {
    const all = [
      { ...base, id: 'a', selected_date: '2027-05-02' },
      {
        ...base,
        id: 'b',
        selected_date: '2027-05-09',
        created_at: '2026-11-22T10:01:00.000Z',
      },
      {
        ...base,
        id: 'c',
        selected_date: '2027-05-16',
        created_at: '2026-11-22T10:10:00.000Z',
      },
    ];
    const members = findSeriesMembers(all[0], all);
    expect(members.map((m) => m.id)).toEqual(['a', 'b']);
  });
});

describe('summarizeSeries', () => {
  it('returns start, end and active counts', () => {
    const summary = summarizeSeries([
      { selected_date: '2027-05-02', status: 'paid', plan_id: 'session', selected_shift: 'morning' },
      { selected_date: '2027-05-09', status: 'cancelled', plan_id: 'session', selected_shift: 'morning' },
      { selected_date: '2027-05-16', status: 'reserved', plan_id: 'session', selected_shift: 'morning' },
    ]);
    expect(summary.start).toBe('2027-05-02');
    expect(summary.end).toBe('2027-05-16');
    expect(summary.total).toBe(3);
    expect(summary.activeCount).toBe(2);
  });
});

describe('groupBookingsForList', () => {
  it('collapses series into one row', () => {
    const list = [
      { id: 1, series_id: 's1', phone: '050', plan_id: 'monthly', selected_shift: 'morning', selected_date: '2027-01-03', status: 'paid', total_price: 500 },
      { id: 2, series_id: 's1', phone: '050', plan_id: 'monthly', selected_shift: 'morning', selected_date: '2027-01-10', status: 'paid', total_price: 0 },
      { id: 3, series_id: null, phone: '050', plan_id: 'hourly', selected_shift: 'afternoon', selected_date: '2027-01-04', status: 'paid', total_price: 260 },
    ];
    const rows = groupBookingsForList(list);
    expect(rows).toHaveLength(2);
    expect(rows[0].isSeries).toBe(true);
    expect(rows[0].members).toHaveLength(2);
    expect(rows[1].isSeries).toBe(false);
  });
});
