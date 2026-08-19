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
  formatCountdown,
  formatShanghaiDateTime,
  getShanghaiDate,
  shanghaiDateToEndMs,
  shanghaiLocalInputToIso
} from '../lib/dateTime';
import {
  Calendar as CalendarIcon,
  ChevronDown,
  Clock,
  Filter,
  MapPin,
  Plus,
  Share2,
  Sparkles,
  Trash2,
  X
} from 'lucide-react';

const EVENT_TYPE_MAP: Record<CalendarEntryCategory, { label: string; badge: string }> = {
  holiday: { label: '法定节假', badge: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' },
  exam: { label: '统考测评', badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' },
  activity: { label: '校园活动', badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
  academic: { label: '学术教研', badge: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300' },
  notice: { label: '通知 DDL', badge: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' }
};

const SCHOOL_EVENT_OPTIONS: SchoolEventCategory[] = ['holiday', 'exam', 'activity', 'academic'];
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
  const [eventToDelete, setEventToDelete] = useState<CalendarEntry | null>(null);
  const [posterJob, setPosterJob] = useState<PosterExportJob | null>(null);
  const [exporting, setExporting] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const [now, setNow] = useState(() => Date.now());

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
  const filteredEvents = selectedCategory === 'all'
    ? entries
    : entries.filter((event) => event.category === selectedCategory);

  const currentCategoryLabel = selectedCategory === 'all'
    ? `全部校历 (${entries.length})`
    : `${EVENT_TYPE_MAP[selectedCategory as CalendarEntryCategory]?.label || selectedCategory} (${entries.filter((event) => event.category === selectedCategory).length})`;

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
    setShareMessage(result === 'shared' ? '已打开系统分享面板' : result === 'downloaded' ? '日历长图已下载' : '已取消分享');
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
    setShareMessage('正在生成未来 30 天日历长图…');
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
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 sm:p-5 lg:flex-row lg:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
            <CalendarIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            学校校历与学期关键日程
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">校园日程与通知 DDL 自动汇总，按北京时间展示</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative" ref={dropdownRef}>
            <button type="button" onClick={() => setShowCategoryDropdown((visible) => !visible)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200/60 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200/80 dark:border-slate-700/60 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700/80">
              <Filter className="h-3.5 w-3.5 text-slate-500" /><span>{currentCategoryLabel}</span><ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>
            {showCategoryDropdown ? (
              <div className="absolute right-0 z-30 mt-1.5 w-44 rounded-xl border border-slate-200 bg-white p-1.5 text-xs shadow-xl dark:border-slate-800 dark:bg-slate-900">
                <button type="button" onClick={() => { setSelectedCategory('all'); setShowCategoryDropdown(false); }} className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left ${selectedCategory === 'all' ? 'bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
                  <span>全部校历</span><span className="text-[10px] text-slate-400">{entries.length}</span>
                </button>
                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                {Object.entries(EVENT_TYPE_MAP).map(([key, info]) => (
                  <button type="button" key={key} onClick={() => { setSelectedCategory(key); setShowCategoryDropdown(false); }} className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left ${selectedCategory === key ? 'bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
                    <span>{info.label}</span><span className="text-[10px] text-slate-400">{entries.filter((entry) => entry.category === key).length}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <button type="button" onClick={handleExportCalendar} disabled={exporting} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-indigo-200 hover:text-indigo-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <Share2 className="h-3.5 w-3.5" />{exporting ? '生成中' : '分享未来30天'}
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

      <div className="space-y-3">
        {filteredEvents.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 py-12 text-center dark:border-slate-800/80 dark:bg-slate-900">
            <CalendarIcon className="mx-auto mb-2 h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">暂无符合条件的校历记录</p>
            <p className="mt-0.5 text-[11px] text-slate-400">通知填写 DDL 后也会自动出现在这里</p>
          </div>
        ) : filteredEvents.map((event) => {
          const typeInfo = EVENT_TYPE_MAP[event.category];
          const countdownTarget = event.startsAt || shanghaiDateToEndMs(event.date);
          const isPast = new Date(countdownTarget).getTime() <= now;
          return (
            <div key={event.id} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs transition-colors hover:border-slate-300 dark:border-slate-800/80 dark:bg-slate-900 dark:hover:border-slate-700 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2"><span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${typeInfo.badge}`}>{typeInfo.label}</span><h3 className="text-xs font-bold text-slate-900 dark:text-white sm:text-sm">{event.title}</h3></div>
                  {event.description ? <p className="whitespace-pre-line text-xs leading-relaxed text-slate-600 dark:text-slate-300">{event.description}</p> : null}
                  <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{event.startsAt ? `时间：${formatShanghaiDateTime(event.startsAt)}` : `日期：${event.date}`}</span>
                    {event.location ? <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />地点：{event.location}</span> : null}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${isPast ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' : event.source === 'notice' ? 'bg-rose-500 text-white' : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'}`}>{formatCountdown(countdownTarget, now)}</span>
                  {isCommittee && event.source === 'schoolEvent' ? <button type="button" onClick={() => setEventToDelete(event)} className="rounded-md p-1 text-slate-400 transition-colors hover:text-rose-600" title="删除事件"><Trash2 className="h-3.5 w-3.5" /></button> : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

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
