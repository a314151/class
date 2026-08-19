export const APP_TIME_ZONE = 'Asia/Shanghai';
const SHANGHAI_OFFSET = '+08:00';
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

const partsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

const getParts = (value: string | number | Date) => Object.fromEntries(
  partsFormatter
    .formatToParts(new Date(value))
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, part.value])
);

export const formatShanghaiDateTime = (value: string | number | Date): string => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '时间待确认';
  return dateTimeFormatter.format(date).replaceAll('/', '-');
};

export const getShanghaiDate = (value: string | number | Date): string => {
  const parts = getParts(value);
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export const isoToShanghaiLocalInput = (value?: string | null): string => {
  if (!value || !Number.isFinite(Date.parse(value))) return '';
  const parts = getParts(value);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};

export const shanghaiLocalInputToIso = (value: string): string | undefined => {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(value);
  if (!match) return undefined;
  const date = new Date(`${match[1]}T${match[2]}:00${SHANGHAI_OFFSET}`);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
};

export const shanghaiDateToStartIso = (date: string): string => (
  new Date(`${date}T00:00:00${SHANGHAI_OFFSET}`).toISOString()
);

export const shanghaiDateToEndMs = (date: string): number => (
  new Date(`${date}T23:59:59.999${SHANGHAI_OFFSET}`).getTime()
);

export const formatCountdown = (
  target: string | number | Date,
  now: string | number | Date = Date.now()
): string => {
  const targetMs = new Date(target).getTime();
  const nowMs = new Date(now).getTime();
  if (!Number.isFinite(targetMs) || !Number.isFinite(nowMs)) return '时间待确认';
  const diff = targetMs - nowMs;
  if (diff <= 0) return '已截止';
  if (diff < MINUTE_MS) return '即将截止';

  const days = Math.floor(diff / DAY_MS);
  const hours = Math.floor((diff % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((diff % HOUR_MS) / MINUTE_MS);
  if (days > 0) return `还剩 ${days} 天 ${hours} 小时`;
  if (hours > 0) return `还剩 ${hours} 小时 ${minutes} 分钟`;
  return `还剩 ${minutes} 分钟`;
};

export const addDays = (value: string | number | Date, days: number): Date => (
  new Date(new Date(value).getTime() + days * DAY_MS)
);
