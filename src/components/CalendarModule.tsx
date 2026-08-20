import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CalendarEntry,
  CalendarEntryCategory,
  ClassSettings,
  Notice,
  SchoolEvent,
  SchoolEventCategory
} from '../types';
import {
  addSchoolEvent,
  deleteSchoolEvent,
  subscribeToNotices,
  subscribeToSchoolEvents
} from '../services/firestoreService';
import { useAuth } from '../context/AuthContext';
import { ConfirmModal } from './ConfirmModal';
import {
  CalendarSharePoster,
  PosterExportHost,
  type PosterExportJob
} from './SharePosters';
import { buildCalendarEntries, getUpcomingEntries } from '../lib/calendarEntries';
import {
  addCalendarMonths,
  buildCalendarMonthDays,
  formatCalendarMonth,
  getMonthKey
} from '../lib/calendarMonth';
import {
  formatCountdown,
  formatShanghaiDateTime,
  getShanghaiDate,
  shanghaiDateToEndMs,
  shanghaiLocalInputToIso
} from '../lib/dateTime';
import {
  BellRing,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Filter,
  MapPin,
  Plus,
  Sparkles,
  Trash2,
  X
} from 'lucide-react';

const EVENT_TYPE_MAP: Record<CalendarEntryCategory, { label: string; badge: string; chip: string; dot: string }> = {
  holiday: {
    label: '法定节假',
    badge: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
    chip: 'border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200',
    dot: 'bg-rose-500'
  },
  exam: {
    label: '统考测评',
    badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    chip: 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200',
    dot: 'bg-amber-500'
  },
  activity: {
    label: '校园活动',
    badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    chip: 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200',
    dot: 'bg-emerald-500'
  },
  academic: {
    label: '学术教研',
    badge: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',
    chip: 'border-indigo-200 bg-indigo-50 text-indigo-900 hover:bg-indigo-100 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-200',
    dot: 'bg-indigo-500'
  },
  notice: {
    label: '通知 DDL',
    badge: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
    chip: 'border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200',
    dot: 'bg-rose-500'
  }
};

const SCHOOL_EVENT_OPTIONS: SchoolEventCategory[] = ['holiday', 'exam', 'activity', 'academic'];
const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const AiImportModal = React.lazy(() => import('./AiImportModal').then((module) => ({ default: module.AiImportModal })));

interface CalendarModuleProps {
  settings: ClassSettings;
}

export const CalendarModule: React.FC<CalendarModuleProps> = ({ settings }) => {
  const { isCommittee } = useAuth();
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAiImport, setShowAiImport] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEntry | null>(null);
  const [eventToDelete, setEventToDelete] = useState<CalendarEntry | null>(null);
  const [posterJob, setPosterJob] = useState<PosterExportJob | null>(null);
  const [exporting, setExporting] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const todayKey = getShanghaiDate(now);
  const [visibleMonth, setVisibleMonth] = useState(() => getMonthKey(getShanghaiDate(Date.now())));

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [startsAtLocal, setStartsAtLocal] = useState('');
  const [category, setCategory] = useState<SchoolEventCategory>('activity');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => subscribeToSchoolEvents(setEvents), []);
  useEffect(() => subscribeToNotices(setNotices), []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const entries = useMemo(() => buildCalendarEntries(events, notices), [events, notices]);
  const schoolEntries = useMemo(
    () => entries.filter((entry) => entry.source === 'schoolEvent'),
    [entries]
  );
  const ddlEntries = useMemo(() => (
    entries
      .filter((entry) => entry.source === 'notice')
      .slice()
      .sort((left, right) => {
        const leftTime = Date.parse(left.deadlineAt || left.startsAt || '');
        const rightTime = Date.parse(right.deadlineAt || right.startsAt || '');
        const leftPast = leftTime <= now;
        const rightPast = rightTime <= now;
        if (leftPast !== rightPast) return leftPast ? 1 : -1;
        return leftPast ? rightTime - leftTime : leftTime - rightTime;
      })
  ), [entries, now]);
  const filteredSchoolEntries = useMemo(
    () => selectedCategory === 'all'
      ? schoolEntries
      : schoolEntries.filter((entry) => entry.category === selectedCategory),
    [schoolEntries, selectedCategory]
  );
  const calendarDays = useMemo(
    () => buildCalendarMonthDays(visibleMonth, todayKey),
    [todayKey, visibleMonth]
  );
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEntry[]>();
    for (const entry of filteredSchoolEntries) {
      const dayEntries = grouped.get(entry.date) || [];
      dayEntries.push(entry);
      grouped.set(entry.date, dayEntries);
    }
    return grouped;
  }, [filteredSchoolEntries]);
  const monthEventCount = useMemo(
    () => filteredSchoolEntries.filter((entry) => getMonthKey(entry.date) === visibleMonth).length,
    [filteredSchoolEntries, visibleMonth]
  );

  const currentCategoryLabel = selectedCategory === 'all'
    ? `全部类型 (${schoolEntries.length})`
    : `${EVENT_TYPE_MAP[selectedCategory as CalendarEntryCategory]?.label || selectedCategory} (${schoolEntries.filter((entry) => entry.category === selectedCategory).length})`;

  const handleAddEvent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !date) return;
    setSubmitting(true);
    try {
      await addSchoolEvent({
        title: title.trim(),
        date,
        startsAt: startsAtLocal ? shanghaiLocalInputToIso(startsAtLocal) : undefined,
        category,
        description: description.trim(),
        location: location.trim() || undefined
      });
      setTitle('');
      setDate('');
      setStartsAtLocal('');
      setDescription('');
      setLocation('');
      setShowAddModal(false);
    } catch (error) {
      console.error('Failed to add school event:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePosterComplete = useCallback((result: 'shared' | 'downloaded' | 'cancelled') => {
    setShareMessage(result === 'downloaded' ? '日历长图已保存到下载目录' : result === 'shared' ? '已打开系统分享面板' : '已取消保存');
    setPosterJob(null);
    setExporting(false);
  }, []);

  const handlePosterError = useCallback((message: string) => {
    setShareMessage(message);
    setPosterJob(null);
    setExporting(false);
  }, []);

  const handleExportCalendar = () => {
    const generatedAt = new Date();
    const upcoming = getUpcomingEntries(entries, generatedAt, 30);
    setExporting(true);
    setShareMessage('正在生成未来 30 天日程长图…');
    setPosterJob({
      id: `calendar-${generatedAt.getTime()}`,
      fileName: `${(settings.className || '班级').replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 50)}-未来30天日程.png`,
      title: `${settings.className || '班级'}未来 30 天日程`,
      text: `未来 30 天共有 ${upcoming.length} 项日程`,
      content: (
        <CalendarSharePoster
          entries={upcoming}
          className={settings.className}
          semester={settings.semester}
          generatedAt={generatedAt}
        />
      )
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 sm:p-5 xl:flex-row xl:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
            <CalendarIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            学校校历与学期关键日程
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">校历按月查看，通知中的 DDL 在下方自动同步</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative" ref={dropdownRef}>
            <button type="button" onClick={() => setShowCategoryDropdown((visible) => !visible)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200/60 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200/80 dark:border-slate-700/60 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700/80">
              <Filter className="h-3.5 w-3.5 text-slate-500" /><span>{currentCategoryLabel}</span><ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>
            {showCategoryDropdown ? (
              <div className="absolute right-0 z-30 mt-1.5 w-44 rounded-xl border border-slate-200 bg-white p-1.5 text-xs shadow-xl dark:border-slate-800 dark:bg-slate-900">
                <button type="button" onClick={() => { setSelectedCategory('all'); setShowCategoryDropdown(false); }} className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left ${selectedCategory === 'all' ? 'bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
                  <span>全部类型</span><span className="text-[10px] text-slate-400">{schoolEntries.length}</span>
                </button>
                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                {SCHOOL_EVENT_OPTIONS.map((key) => (
                  <button type="button" key={key} onClick={() => { setSelectedCategory(key); setShowCategoryDropdown(false); }} className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left ${selectedCategory === key ? 'bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
                    <span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${EVENT_TYPE_MAP[key].dot}`} />{EVENT_TYPE_MAP[key].label}</span><span className="text-[10px] text-slate-400">{schoolEntries.filter((entry) => entry.category === key).length}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <button type="button" onClick={handleExportCalendar} disabled={exporting} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300">
            <Download className="h-3.5 w-3.5" />{exporting ? '生成中…' : '保存未来 30 天长图'}
          </button>

          {isCommittee ? (
            <>
              <button type="button" onClick={() => setShowAiImport(true)} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-100 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-300">
                <Sparkles className="h-3.5 w-3.5" />AI 导入
              </button>
              <button type="button" onClick={() => setShowAddModal(true)} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700">
                <Plus className="h-3.5 w-3.5" />添加事件
              </button>
            </>
          ) : null}
        </div>
      </div>

      {shareMessage ? <div role="status" className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-300">{shareMessage}</div> : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800/80 dark:bg-slate-900" aria-labelledby="school-calendar-heading">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h3 id="school-calendar-heading" className="text-sm font-bold text-slate-900 dark:text-white">学校月历</h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">本月 {monthEventCount} 项校历事件 · 点击事件查看详情</p>
          </div>
          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <button type="button" onClick={() => setVisibleMonth(addCalendarMonths(visibleMonth, -1))} aria-label="上个月" className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-indigo-600 dark:border-slate-700 dark:hover:bg-slate-800"><ChevronLeft className="h-4 w-4" /></button>
            <div className="min-w-32 px-2 text-center text-sm font-black text-slate-900 dark:text-white">{formatCalendarMonth(visibleMonth)}</div>
            <button type="button" onClick={() => setVisibleMonth(addCalendarMonths(visibleMonth, 1))} aria-label="下个月" className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-indigo-600 dark:border-slate-700 dark:hover:bg-slate-800"><ChevronRight className="h-4 w-4" /></button>
            <button type="button" onClick={() => setVisibleMonth(getMonthKey(todayKey))} className="ml-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-indigo-950/50">今天</button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50" role="row">
          {WEEKDAY_LABELS.map((label, index) => <div key={label} className={`px-1 py-2 text-center text-[10px] font-bold sm:text-[11px] ${index > 4 ? 'text-indigo-500' : 'text-slate-500 dark:text-slate-400'}`} role="columnheader">{label}</div>)}
        </div>
        <div className="grid grid-cols-7" role="grid" aria-label={`${formatCalendarMonth(visibleMonth)}学校月历`}>
          {calendarDays.map((day, index) => {
            const dayEvents = eventsByDate.get(day.date) || [];
            return (
              <div
                key={day.date}
                role="gridcell"
                aria-label={`${day.date}，${dayEvents.length} 项事件`}
                className={`min-h-24 border-b border-r border-slate-200 p-1.5 align-top dark:border-slate-800 sm:min-h-28 sm:p-2 ${index % 7 === 6 ? 'border-r-0' : ''} ${index >= 35 ? 'border-b-0' : ''} ${day.isCurrentMonth ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/80 dark:bg-slate-950/40'}`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[11px] font-bold ${day.isToday ? 'bg-indigo-600 text-white shadow-sm' : day.isCurrentMonth ? 'text-slate-700 dark:text-slate-200' : 'text-slate-300 dark:text-slate-600'}`}>{day.dayNumber}</span>
                  {dayEvents.length > 0 ? <span className="text-[9px] font-semibold text-slate-400">{dayEvents.length} 项</span> : null}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((entry) => {
                    const typeInfo = EVENT_TYPE_MAP[entry.category];
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => setSelectedEvent(entry)}
                        title={`${typeInfo.label}：${entry.title}`}
                        className={`flex w-full min-w-0 items-center gap-1 rounded-md border px-1.5 py-1 text-left text-[9px] font-semibold leading-tight transition sm:text-[10px] ${typeInfo.chip}`}
                      >
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${typeInfo.dot}`} />
                        <span className="truncate">{entry.title}</span>
                      </button>
                    );
                  })}
                  {dayEvents.length > 3 ? <button type="button" onClick={() => setSelectedEvent(dayEvents[3])} className="w-full rounded-md px-1 py-0.5 text-left text-[9px] font-bold text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40">还有 {dayEvents.length - 3} 项</button> : null}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40 sm:px-5">
          {SCHOOL_EVENT_OPTIONS.map((value) => <span key={value} className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400"><span className={`h-2 w-2 rounded-full ${EVENT_TYPE_MAP[value].dot}`} />{EVENT_TYPE_MAP[value].label}</span>)}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 sm:p-5" aria-labelledby="ddl-heading">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 id="ddl-heading" className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white"><BellRing className="h-4 w-4 text-rose-500" />同步 DDL</h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">从重要通知自动同步，共 {ddlEntries.length} 项；不会再混入学校月历</p>
          </div>
          <span className="text-[10px] font-medium text-slate-400">所有时间均为北京时间</span>
        </div>

        {ddlEntries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center dark:border-slate-700 dark:bg-slate-950/40">
            <BellRing className="mx-auto mb-2 h-6 w-6 text-slate-300 dark:text-slate-600" />
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">暂时没有同步 DDL</p>
            <p className="mt-1 text-[11px] text-slate-400">通知设置截止时间后会自动出现在这里</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {ddlEntries.map((entry) => {
              const countdownTarget = entry.deadlineAt || entry.startsAt || shanghaiDateToEndMs(entry.date);
              const isPast = new Date(countdownTarget).getTime() <= now;
              return (
                <article key={entry.id} className={`grid gap-3 px-3.5 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-4 ${isPast ? 'bg-slate-50/70 dark:bg-slate-950/30' : 'bg-white dark:bg-slate-900'}`}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${isPast ? 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400' : EVENT_TYPE_MAP.notice.badge}`}>{isPast ? '已截止' : '待完成'}</span>
                      <h4 className={`text-xs font-bold sm:text-sm ${isPast ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-white'}`}>{entry.title}</h4>
                    </div>
                    {entry.description ? <p className="mt-1 line-clamp-2 whitespace-pre-line text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{entry.description}</p> : null}
                  </div>
                  <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end sm:gap-1.5">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400"><Clock className="h-3 w-3" />{entry.startsAt ? formatShanghaiDateTime(entry.startsAt) : entry.date}</span>
                    <span className={`rounded-lg px-2.5 py-1 text-[11px] font-black ${isPast ? 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400' : 'bg-rose-500 text-white'}`}>{formatCountdown(countdownTarget, now)}</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {selectedEvent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs" role="dialog" aria-modal="true" aria-labelledby="calendar-event-detail-title">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${EVENT_TYPE_MAP[selectedEvent.category].badge}`}>{EVENT_TYPE_MAP[selectedEvent.category].label}</span>
                <h3 id="calendar-event-detail-title" className="mt-2 text-base font-black text-slate-900 dark:text-white">{selectedEvent.title}</h3>
              </div>
              <button type="button" onClick={() => setSelectedEvent(null)} aria-label="关闭日程详情" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"><X className="h-4 w-4" /></button>
            </div>
            {selectedEvent.description ? <p className="mt-4 whitespace-pre-line text-xs leading-relaxed text-slate-600 dark:text-slate-300">{selectedEvent.description}</p> : null}
            <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-950/50 dark:text-slate-300">
              <div className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-indigo-500" />{selectedEvent.startsAt ? formatShanghaiDateTime(selectedEvent.startsAt) : selectedEvent.date}</div>
              {selectedEvent.location ? <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-indigo-500" />{selectedEvent.location}</div> : null}
            </div>
            <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              {isCommittee ? <button type="button" onClick={() => { setEventToDelete(selectedEvent); setSelectedEvent(null); }} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"><Trash2 className="h-3.5 w-3.5" />删除事件</button> : null}
              <button type="button" onClick={() => setSelectedEvent(null)} className="rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">知道了</button>
            </div>
          </div>
        </div>
      ) : null}

      {showAddModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800"><h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white"><Plus className="h-4 w-4 text-indigo-600" />新增学校日历日程</h3><button type="button" onClick={() => setShowAddModal(false)} aria-label="关闭新增日程" className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X className="h-4 w-4" /></button></div>
            <form onSubmit={handleAddEvent} className="space-y-3">
              <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">日程名称 *</span><input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：期中统考测试" className="form-field" /></label>
              <div className="grid grid-cols-2 gap-3">
                <label><span className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">发生日期 *</span><input type="date" required value={date} onChange={(event) => { setDate(event.target.value); setStartsAtLocal(''); }} className="form-field" /></label>
                <label><span className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">事件类别</span><select value={category} onChange={(event) => setCategory(event.target.value as SchoolEventCategory)} className="form-field">{SCHOOL_EVENT_OPTIONS.map((value) => <option key={value} value={value}>{EVENT_TYPE_MAP[value].label}</option>)}</select></label>
              </div>
              <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">精确时间（选填，北京时间）</span><input type="datetime-local" value={startsAtLocal} onChange={(event) => { setStartsAtLocal(event.target.value); const startsAt = shanghaiLocalInputToIso(event.target.value); if (startsAt) setDate(getShanghaiDate(startsAt)); }} className="form-field" /></label>
              <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">地点 / 考场</span><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="例如：主教学楼 302" className="form-field" /></label>
              <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">详情说明</span><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} className="form-field resize-none" /></label>
              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800"><button type="button" onClick={() => setShowAddModal(false)} className="rounded-xl px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">取消</button><button type="submit" disabled={submitting} className="rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50">{submitting ? '保存中…' : '确认添加'}</button></div>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmModal isOpen={Boolean(eventToDelete)} title="确认删除该校历事件？" message={`确定要删除 "${eventToDelete?.title}" (${eventToDelete?.date}) 吗？删除后班级校历将不再显示该日程。`} confirmText="确认删除" onConfirm={async () => { if (eventToDelete?.source === 'schoolEvent') await deleteSchoolEvent(eventToDelete.id.replace(/^schoolEvent:/, '')); }} onClose={() => setEventToDelete(null)} />
      {showAiImport ? <React.Suspense fallback={null}><AiImportModal isOpen onClose={() => setShowAiImport(false)} defaultTarget="calendar" /></React.Suspense> : null}
      <PosterExportHost job={posterJob} onComplete={handlePosterComplete} onError={handlePosterError} />
    </div>
  );
};
