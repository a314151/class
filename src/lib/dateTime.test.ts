import { describe, expect, it } from 'vitest';
import {
  formatCountdown,
  getShanghaiDate,
  isoToShanghaiLocalInput,
  shanghaiLocalInputToIso
} from './dateTime';

describe('dateTime', () => {
  it('converts datetime-local values using the fixed Shanghai offset', () => {
    expect(shanghaiLocalInputToIso('2026-08-20T10:30')).toBe('2026-08-20T02:30:00.000Z');
    expect(isoToShanghaiLocalInput('2026-08-20T02:30:00.000Z')).toBe('2026-08-20T10:30');
  });

  it('uses Shanghai when an instant crosses the UTC date boundary', () => {
    expect(getShanghaiDate('2026-08-19T17:00:00.000Z')).toBe('2026-08-20');
  });

  it('formats deadline boundary states', () => {
    const now = '2026-08-19T00:00:00.000Z';
    expect(formatCountdown('2026-08-20T02:30:00.000Z', now)).toBe('还剩 1 天 2 小时');
    expect(formatCountdown('2026-08-19T00:00:30.000Z', now)).toBe('即将截止');
    expect(formatCountdown('2026-08-18T23:59:59.000Z', now)).toBe('已截止');
  });
});
