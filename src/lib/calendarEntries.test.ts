import { describe, expect, it } from 'vitest';
import type { Notice, SchoolEvent } from '../types';
import { buildCalendarEntries, getUpcomingEntries } from './calendarEntries';

const notice = (overrides: Partial<Notice> = {}): Notice => ({
  id: 'notice-1',
  title: '提交报名表',
  content: '请按时提交',
  category: 'routine',
  isPinned: false,
  authorName: '班委',
  authorUid: 'u1',
  readBy: [],
  createdAt: '2026-08-19T00:00:00.000Z',
  ...overrides
});
const event = (overrides: Partial<SchoolEvent> = {}): SchoolEvent => ({
  id: 'event-1',
  title: '班会',
  date: '2026-08-20',
  category: 'activity',
  description: '',
  ...overrides
});

describe('calendarEntries', () => {
  it('merges exact notice deadlines without copying Firestore records', () => {
    const entries = buildCalendarEntries(
      [event({ startsAt: '2026-08-20T06:00:00.000Z' })],
      [notice({ deadlineAt: '2026-08-20T02:00:00.000Z' })]
    );
    expect(entries.map((entry) => entry.id)).toEqual(['notice:notice-1', 'schoolEvent:event-1']);
    expect(entries[0]).toMatchObject({ source: 'notice', category: 'notice', date: '2026-08-20' });
  });

  it('ignores notices without a valid deadline for backwards compatibility', () => {
    expect(buildCalendarEntries([], [notice(), notice({ id: 'bad', deadlineAt: 'not-a-date' })])).toEqual([]);
  });

  it('includes ongoing date-only items and enforces the 30-day window', () => {
    const entries = buildCalendarEntries([
      event({ id: 'today', date: '2026-08-19' }),
      event({ id: 'day-30', date: '2026-09-18' }),
      event({ id: 'day-31', date: '2026-09-19' })
    ], []);
    const upcoming = getUpcomingEntries(entries, '2026-08-19T04:00:00.000Z', 30);
    expect(upcoming.map((entry) => entry.id)).toEqual(['schoolEvent:today', 'schoolEvent:day-30']);
  });
});
