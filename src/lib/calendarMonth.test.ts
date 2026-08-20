import { describe, expect, it } from 'vitest';
import {
  addCalendarMonths,
  buildCalendarMonthDays,
  formatCalendarMonth,
  getMonthKey
} from './calendarMonth';

describe('calendar month helpers', () => {
  it('builds a Monday-first six-week grid', () => {
    const days = buildCalendarMonthDays('2026-08', '2026-08-20');
    expect(days).toHaveLength(42);
    expect(days[0].date).toBe('2026-07-27');
    expect(days[41].date).toBe('2026-09-06');
    expect(days.find((day) => day.date === '2026-08-20')).toMatchObject({
      isCurrentMonth: true,
      isToday: true,
      dayNumber: 20
    });
  });

  it('moves across year boundaries and formats labels', () => {
    expect(addCalendarMonths('2026-12', 1)).toBe('2027-01');
    expect(addCalendarMonths('2026-01', -1)).toBe('2025-12');
    expect(formatCalendarMonth('2026-08')).toBe('2026 年 8 月');
    expect(getMonthKey('2026-08-20')).toBe('2026-08');
  });
});
