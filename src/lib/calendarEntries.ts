import type { CalendarEntry, Notice, SchoolEvent } from '../types';
import {
  addDays,
  getShanghaiDate,
  shanghaiDateToEndMs,
  shanghaiDateToStartIso
} from './dateTime';

export const buildCalendarEntries = (
  events: SchoolEvent[],
  notices: Notice[]
): CalendarEntry[] => {
  const calendarEvents: CalendarEntry[] = events.map((event) => ({
    id: `schoolEvent:${event.id}`,
    source: 'schoolEvent',
    title: event.title,
    date: event.date,
    startsAt: event.startsAt,
    category: event.category,
    description: event.description,
    location: event.location
  }));

  for (const notice of notices) {
    if (!notice.deadlineAt || !Number.isFinite(Date.parse(notice.deadlineAt))) continue;
    calendarEvents.push({
      id: `notice:${notice.id}`,
      source: 'notice',
      title: notice.title,
      date: getShanghaiDate(notice.deadlineAt),
      startsAt: notice.deadlineAt,
      deadlineAt: notice.deadlineAt,
      category: 'notice',
      description: notice.content,
      noticeId: notice.id
    });
  }

  return calendarEvents.slice().sort((a, b) => getEntryStartMs(a) - getEntryStartMs(b));
};

export const getEntryStartMs = (entry: CalendarEntry): number => {
  const timestamp = entry.startsAt ? Date.parse(entry.startsAt) : Date.parse(shanghaiDateToStartIso(entry.date));
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
};

export const getEntryEndMs = (entry: CalendarEntry): number => (
  entry.startsAt ? getEntryStartMs(entry) : shanghaiDateToEndMs(entry.date)
);

export const getUpcomingEntries = (
  entries: CalendarEntry[],
  now: string | number | Date = Date.now(),
  days = 30
): CalendarEntry[] => {
  const nowMs = new Date(now).getTime();
  const limitMs = addDays(now, days).getTime();
  return entries.filter((entry) => {
    const startMs = getEntryStartMs(entry);
    return getEntryEndMs(entry) >= nowMs && startMs <= limitMs;
  });
};
