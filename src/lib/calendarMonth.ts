export interface CalendarMonthDay {
  date: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

const MONTH_KEY_PATTERN = /^(\d{4})-(\d{2})$/;

const parseMonthKey = (monthKey: string) => {
  const match = MONTH_KEY_PATTERN.exec(monthKey);
  if (!match) throw new Error(`Invalid month key: ${monthKey}`);
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) throw new Error(`Invalid month key: ${monthKey}`);
  return { year, monthIndex };
};

const toDateKey = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getMonthKey = (dateKey: string): string => dateKey.slice(0, 7);

export const addCalendarMonths = (monthKey: string, amount: number): string => {
  const { year, monthIndex } = parseMonthKey(monthKey);
  const date = new Date(Date.UTC(year, monthIndex + amount, 1));
  return toDateKey(date).slice(0, 7);
};

export const formatCalendarMonth = (monthKey: string): string => {
  const { year, monthIndex } = parseMonthKey(monthKey);
  return `${year} 年 ${monthIndex + 1} 月`;
};

export const buildCalendarMonthDays = (
  monthKey: string,
  todayKey: string
): CalendarMonthDay[] => {
  const { year, monthIndex } = parseMonthKey(monthKey);
  const firstDay = new Date(Date.UTC(year, monthIndex, 1));
  const mondayOffset = (firstDay.getUTCDay() + 6) % 7;
  const gridStart = new Date(Date.UTC(year, monthIndex, 1 - mondayOffset));

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart.getTime());
    date.setUTCDate(gridStart.getUTCDate() + index);
    const dateKey = toDateKey(date);
    return {
      date: dateKey,
      dayNumber: date.getUTCDate(),
      isCurrentMonth: date.getUTCMonth() === monthIndex,
      isToday: dateKey === todayKey
    };
  });
};
