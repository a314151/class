import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Megaphone,
  Sparkles,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { postJson } from '../services/apiClient';
import { addNotice, addSchoolEvent } from '../services/firestoreService';
import type { NoticeCategory, SchoolEventCategory } from '../types';
import {
  aiEventDraftSchema,
  aiImportDraftSchema,
  aiNoticeDraftSchema,
  type AiEventDraft,
  type AiImportDraft,
  type AiNoticeDraft
} from '../lib/aiImport';
import {
  getShanghaiDate,
  isoToShanghaiLocalInput,
  shanghaiLocalInputToIso
} from '../lib/dateTime';

const NOTICE_OPTIONS: Array<{ value: NoticeCategory; label: string }> = [
  { value: 'urgent', label: '紧急加急' },
  { value: 'exam', label: '考试安排' },
  { value: 'activity', label: '班级活动' },
  { value: 'fee', label: '费用通知' },
  { value: 'holiday', label: '放假安排' },
  { value: 'academic', label: '学术研讨' },
  { value: 'routine', label: '日常事务' }
];

const EVENT_OPTIONS: Array<{ value: SchoolEventCategory; label: string }> = [
  { value: 'holiday', label: '法定节假' },
  { value: 'exam', label: '统考测评' },
  { value: 'activity', label: '校园活动' },
  { value: 'academic', label: '学术教研' }
];

type PublishStatus = 'idle' | 'publishing' | 'published' | 'linked' | 'error';

interface EditableNotice {
  value: AiNoticeDraft;
  selected: boolean;
  status: PublishStatus;
  error?: string;
}

interface EditableEvent {
  key: string;
  value: AiEventDraft;
  selected: boolean;
  status: PublishStatus;
  error?: string;
}

interface AiImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTarget: 'notice' | 'calendar';
}

const toErrorMessage = (error: unknown): string => (
  error instanceof Error ? error.message : '操作失败，请稍后重试'
);

const isSameMinute = (left?: string | null, right?: string | null): boolean => {
  if (!left || !right) return false;
  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);
  return Number.isFinite(leftMs) && Number.isFinite(rightMs)
    && Math.floor(leftMs / 60_000) === Math.floor(rightMs / 60_000);
};

export const AiImportModal: React.FC<AiImportModalProps> = ({ isOpen, onClose, defaultTarget }) => {
  const { profile } = useAuth();
  const [sourceText, setSourceText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [draft, setDraft] = useState<AiImportDraft | null>(null);
  const [noticeDraft, setNoticeDraft] = useState<EditableNotice | null>(null);
  const [eventDrafts, setEventDrafts] = useState<EditableEvent[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) return;
    setSourceText('');
    setDraft(null);
    setNoticeDraft(null);
    setEventDrafts([]);
    setError('');
    setParsing(false);
    setPublishing(false);
  }, [isOpen]);

  const selectedCount = useMemo(() => (
    (noticeDraft?.selected && noticeDraft.status !== 'published' ? 1 : 0)
    + eventDrafts.filter((event) => event.selected && !['published', 'linked'].includes(event.status)).length
  ), [eventDrafts, noticeDraft]);

  if (!isOpen) return null;

  const handleParse = async () => {
    const text = sourceText.trim();
    if (!text) {
      setError('请先粘贴一段微信消息');
      return;
    }
    setParsing(true);
    setError('');
    try {
      const response = await postJson<unknown>('/api/ai/parse-message', { text }, 30_000);
      const parsed = aiImportDraftSchema.safeParse(response);
      if (!parsed.success) throw new Error('AI 返回的数据格式不完整，请重试');
      setDraft(parsed.data);
      setNoticeDraft(parsed.data.notice ? {
        value: parsed.data.notice,
        selected: defaultTarget === 'notice',
        status: 'idle'
      } : null);
      setEventDrafts(parsed.data.events.map((event, index) => ({
        key: `${Date.now()}-${index}`,
        value: event,
        selected: defaultTarget === 'calendar' || parsed.data.notice === null,
        status: 'idle'
      })));
    } catch (parseError) {
      setError(toErrorMessage(parseError));
    } finally {
      setParsing(false);
    }
  };

  const updateNotice = (updates: Partial<AiNoticeDraft>) => {
    setNoticeDraft((current) => current ? {
      ...current,
      value: { ...current.value, ...updates },
      status: current.status === 'error' ? 'idle' : current.status,
      error: undefined
    } : null);
  };

  const updateEvent = (key: string, updates: Partial<AiEventDraft>) => {
    setEventDrafts((current) => current.map((event) => event.key === key ? {
      ...event,
      value: { ...event.value, ...updates },
      status: event.status === 'error' ? 'idle' : event.status,
      error: undefined
    } : event));
  };

  const handlePublish = async () => {
    if (!profile) {
      setError('登录状态已失效，请重新登录');
      return;
    }
    if (selectedCount === 0) {
      setError('请至少勾选一条尚未发布的草稿');
      return;
    }

    setPublishing(true);
    setError('');
    let noticePublished = noticeDraft?.status === 'published';
    const selectedNotice = noticeDraft?.selected ? noticeDraft.value : null;

    if (noticeDraft?.selected && noticeDraft.status !== 'published') {
      const validatedNotice = aiNoticeDraftSchema.safeParse(noticeDraft.value);
      if (!validatedNotice.success) {
        setNoticeDraft((current) => current ? {
          ...current,
          status: 'error',
          error: '请检查通知标题、正文和 DDL 格式'
        } : null);
      } else {
        setNoticeDraft((current) => current ? { ...current, status: 'publishing', error: undefined } : null);
        try {
          await addNotice({
            title: validatedNotice.data.title,
            content: validatedNotice.data.content,
            category: validatedNotice.data.category,
            isPinned: validatedNotice.data.isPinned,
            authorName: profile.name,
            authorUid: profile.uid,
            readBy: [profile.uid],
            createdAt: new Date().toISOString(),
            deadlineAt: validatedNotice.data.deadlineAt || undefined
          });
          noticePublished = true;
          setNoticeDraft((current) => current ? { ...current, status: 'published', error: undefined } : null);
        } catch (publishError) {
          setNoticeDraft((current) => current ? {
            ...current,
            status: 'error',
            error: toErrorMessage(publishError)
          } : null);
        }
      }
    }

    for (const event of eventDrafts) {
      if (!event.selected || ['published', 'linked'].includes(event.status)) continue;
      const validatedEvent = aiEventDraftSchema.safeParse(event.value);
      if (!validatedEvent.success) {
        setEventDrafts((current) => current.map((item) => item.key === event.key
          ? { ...item, status: 'error', error: '请检查日程标题、日期和时间格式' }
          : item));
        continue;
      }
      const linkedToNotice = Boolean(
        selectedNotice?.deadlineAt
        && isSameMinute(selectedNotice.deadlineAt, event.value.startsAt)
      );
      if (linkedToNotice && noticePublished) {
        setEventDrafts((current) => current.map((item) => item.key === event.key
          ? { ...item, status: 'linked', error: undefined }
          : item));
        continue;
      }
      if (linkedToNotice && noticeDraft?.selected && !noticePublished) {
        setEventDrafts((current) => current.map((item) => item.key === event.key
          ? { ...item, status: 'error', error: '等待通知发布成功后自动联动' }
          : item));
        continue;
      }

      setEventDrafts((current) => current.map((item) => item.key === event.key
        ? { ...item, status: 'publishing', error: undefined }
        : item));
      try {
        await addSchoolEvent({
          title: validatedEvent.data.title,
          date: validatedEvent.data.date,
          startsAt: validatedEvent.data.startsAt || undefined,
          category: validatedEvent.data.category,
          description: validatedEvent.data.description,
          location: validatedEvent.data.location || undefined
        });
        setEventDrafts((current) => current.map((item) => item.key === event.key
          ? { ...item, status: 'published', error: undefined }
          : item));
      } catch (publishError) {
        setEventDrafts((current) => current.map((item) => item.key === event.key
          ? { ...item, status: 'error', error: toErrorMessage(publishError) }
          : item));
      }
    }
    setPublishing(false);
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-import-title"
        className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 id="ai-import-title" className="flex items-center gap-2 text-base font-black text-slate-950 dark:text-white">
              <Sparkles className="h-5 w-5 text-violet-600" />
              AI 导入微信消息
            </h2>
            <p className="mt-1 text-xs text-slate-500">消息会发送至 DeepSeek 解析，请勿粘贴敏感个人信息。</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={publishing}
            aria-label="关闭 AI 导入"
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <section>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label htmlFor="ai-source-text" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                微信消息原文
              </label>
              <span className="text-[11px] text-slate-400">{sourceText.length}/8000</span>
            </div>
            <textarea
              id="ai-source-text"
              rows={6}
              maxLength={8000}
              value={sourceText}
              onChange={(event) => setSourceText(event.target.value)}
              placeholder="粘贴群聊通知，例如：请大家在本周五 18:00 前提交报名表，下周一 14:00 在教学楼 302 开会……"
              className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-900 outline-hidden focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={handleParse}
                disabled={parsing || publishing || !sourceText.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {parsing ? '识别中…' : draft ? '重新识别' : '开始识别'}
              </button>
            </div>
          </section>

          {error ? (
            <div role="alert" className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          ) : null}

          {draft?.warnings.length ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/60 dark:bg-amber-950/30">
              <p className="text-xs font-bold text-amber-800 dark:text-amber-300">需要人工确认</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-700 dark:text-amber-400">
                {draft.warnings.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            </div>
          ) : null}

          {noticeDraft ? (
            <section className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/20">
              <div className="mb-4 flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
                  <input
                    type="checkbox"
                    checked={noticeDraft.selected}
                    disabled={noticeDraft.status === 'published'}
                    onChange={(event) => setNoticeDraft((current) => current ? { ...current, selected: event.target.checked } : null)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                  />
                  <Megaphone className="h-4 w-4 text-indigo-600" />
                  通知草稿
                </label>
                <PublishBadge status={noticeDraft.status} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="标题" wide>
                  <input
                    value={noticeDraft.value.title}
                    disabled={noticeDraft.status === 'published'}
                    onChange={(event) => updateNotice({ title: event.target.value })}
                    className="form-field"
                  />
                </Field>
                <Field label="分类">
                  <select
                    value={noticeDraft.value.category}
                    disabled={noticeDraft.status === 'published'}
                    onChange={(event) => updateNotice({ category: event.target.value as NoticeCategory })}
                    className="form-field"
                  >
                    {NOTICE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </Field>
                <Field label="DDL（北京时间）">
                  <input
                    type="datetime-local"
                    value={isoToShanghaiLocalInput(noticeDraft.value.deadlineAt)}
                    disabled={noticeDraft.status === 'published'}
                    onChange={(event) => updateNotice({ deadlineAt: shanghaiLocalInputToIso(event.target.value) || null })}
                    className="form-field"
                  />
                </Field>
                <Field label="正文" wide>
                  <textarea
                    rows={4}
                    value={noticeDraft.value.content}
                    disabled={noticeDraft.status === 'published'}
                    onChange={(event) => updateNotice({ content: event.target.value })}
                    className="form-field resize-y"
                  />
                </Field>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={noticeDraft.value.isPinned}
                    disabled={noticeDraft.status === 'published'}
                    onChange={(event) => updateNotice({ isPinned: event.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                  />
                  置顶通知
                </label>
              </div>
              {noticeDraft.error ? <p className="mt-3 text-xs font-semibold text-rose-600">{noticeDraft.error}</p> : null}
            </section>
          ) : null}

          {eventDrafts.length ? (
            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
                <CalendarClock className="h-4 w-4 text-emerald-600" />
                日程草稿（{eventDrafts.length}）
              </h3>
              {eventDrafts.map((eventDraft, index) => {
                const linkedDuplicate = Boolean(
                  noticeDraft?.selected
                  && noticeDraft.value.deadlineAt
                  && isSameMinute(noticeDraft.value.deadlineAt, eventDraft.value.startsAt)
                );
                return (
                  <div key={eventDraft.key} className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
                        <input
                          type="checkbox"
                          checked={eventDraft.selected}
                          disabled={['published', 'linked'].includes(eventDraft.status)}
                          onChange={(changeEvent) => setEventDrafts((current) => current.map((item) => item.key === eventDraft.key
                            ? { ...item, selected: changeEvent.target.checked }
                            : item))}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                        />
                        日程 {index + 1}
                        {linkedDuplicate ? <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] text-indigo-700">通知 DDL 联动</span> : null}
                      </label>
                      <PublishBadge status={eventDraft.status} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="标题" wide>
                        <input
                          value={eventDraft.value.title}
                          disabled={['published', 'linked'].includes(eventDraft.status)}
                          onChange={(changeEvent) => updateEvent(eventDraft.key, { title: changeEvent.target.value })}
                          className="form-field"
                        />
                      </Field>
                      <Field label="日期">
                        <input
                          type="date"
                          value={eventDraft.value.date}
                          disabled={['published', 'linked'].includes(eventDraft.status)}
                          onChange={(changeEvent) => updateEvent(eventDraft.key, { date: changeEvent.target.value, startsAt: null })}
                          className="form-field"
                        />
                      </Field>
                      <Field label="精确时间（北京时间）">
                        <input
                          type="datetime-local"
                          value={isoToShanghaiLocalInput(eventDraft.value.startsAt)}
                          disabled={['published', 'linked'].includes(eventDraft.status)}
                          onChange={(changeEvent) => {
                            const startsAt = shanghaiLocalInputToIso(changeEvent.target.value) || null;
                            updateEvent(eventDraft.key, {
                              startsAt,
                              date: startsAt ? getShanghaiDate(startsAt) : eventDraft.value.date
                            });
                          }}
                          className="form-field"
                        />
                      </Field>
                      <Field label="分类">
                        <select
                          value={eventDraft.value.category}
                          disabled={['published', 'linked'].includes(eventDraft.status)}
                          onChange={(changeEvent) => updateEvent(eventDraft.key, { category: changeEvent.target.value as SchoolEventCategory })}
                          className="form-field"
                        >
                          {EVENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      </Field>
                      <Field label="地点">
                        <input
                          value={eventDraft.value.location || ''}
                          disabled={['published', 'linked'].includes(eventDraft.status)}
                          onChange={(changeEvent) => updateEvent(eventDraft.key, { location: changeEvent.target.value || null })}
                          className="form-field"
                        />
                      </Field>
                      <Field label="说明" wide>
                        <textarea
                          rows={3}
                          value={eventDraft.value.description}
                          disabled={['published', 'linked'].includes(eventDraft.status)}
                          onChange={(changeEvent) => updateEvent(eventDraft.key, { description: changeEvent.target.value })}
                          className="form-field resize-y"
                        />
                      </Field>
                    </div>
                    {eventDraft.error ? <p className="mt-3 text-xs font-semibold text-rose-600">{eventDraft.error}</p> : null}
                  </div>
                );
              })}
            </section>
          ) : draft ? (
            <p className="rounded-2xl bg-slate-100 px-4 py-3 text-xs text-slate-500 dark:bg-slate-800">
              没有识别到明确日程；如原文包含模糊日期，请根据上方警告人工补充。
            </p>
          ) : null}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
          <p className="text-xs text-slate-500">已选 {selectedCount} 项待发布</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={publishing}
              className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              关闭
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={publishing || selectedCount === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {publishing ? '发布中…' : '发布所选草稿'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; wide?: boolean; children: React.ReactNode }> = ({ label, wide, children }) => (
  <label className={wide ? 'sm:col-span-2' : undefined}>
    <span className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">{label}</span>
    {children}
  </label>
);

const PublishBadge: React.FC<{ status: PublishStatus }> = ({ status }) => {
  const labels: Record<PublishStatus, string> = {
    idle: '待发布',
    publishing: '发布中',
    published: '已发布',
    linked: '已联动',
    error: '发布失败'
  };
  const classes: Record<PublishStatus, string> = {
    idle: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    publishing: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    published: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    linked: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
    error: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
  };
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${classes[status]}`}>{labels[status]}</span>;
};
