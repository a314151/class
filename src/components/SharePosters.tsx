import React, { useEffect, useRef } from 'react';
import type { CalendarEntry, Notice, NoticeCategory, SchoolEventCategory } from '../types';
import {
  formatCountdown,
  formatShanghaiDateTime,
  shanghaiDateToEndMs
} from '../lib/dateTime';
import type { ShareResult } from '../lib/imageShare';

const NOTICE_LABELS: Record<NoticeCategory, string> = {
  urgent: '紧急加急',
  exam: '考试安排',
  activity: '班级活动',
  fee: '费用通知',
  holiday: '放假安排',
  academic: '学术研讨',
  routine: '日常事务'
};

const EVENT_LABELS: Record<SchoolEventCategory | 'notice', string> = {
  holiday: '法定节假',
  exam: '统考测评',
  activity: '校园活动',
  academic: '学术教研',
  notice: '通知 DDL'
};

export interface PosterExportJob {
  id: string;
  fileName: string;
  title: string;
  text: string;
  content: React.ReactNode;
}

interface PosterExportHostProps {
  job: PosterExportJob | null;
  onComplete: (result: ShareResult) => void;
  onError: (message: string) => void;
}

export const PosterExportHost: React.FC<PosterExportHostProps> = ({ job, onComplete, onError }) => {
  const posterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!job || !posterRef.current) return;
    let cancelled = false;
    let frameId = 0;

    frameId = window.requestAnimationFrame(() => {
      frameId = window.requestAnimationFrame(async () => {
        try {
          const { createPosterFile, shareOrDownloadFile } = await import('../lib/imageShare');
          if (cancelled || !posterRef.current) return;
          const file = await createPosterFile(posterRef.current, job.fileName);
          if (cancelled) return;
          const result = await shareOrDownloadFile(file, job.title, job.text);
          if (!cancelled) onComplete(result);
        } catch (error) {
          if (!cancelled) onError(error instanceof Error ? error.message : '长图生成失败，请稍后重试');
        }
      });
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
    };
  }, [job, onComplete, onError]);

  if (!job) return null;
  return (
    <div
      aria-hidden="true"
      className="fixed left-[-10000px] top-0 z-[-1]"
      style={{ width: 750 }}
    >
      <div ref={posterRef} style={{ width: 750 }}>
        {job.content}
      </div>
    </div>
  );
};

interface NoticeSharePosterProps {
  notice: Notice;
  className: string;
  semester?: string;
  generatedAt: Date;
}

export const NoticeSharePoster: React.FC<NoticeSharePosterProps> = ({
  notice,
  className,
  semester,
  generatedAt
}) => (
  <article
    data-testid="notice-share-poster"
    className="w-[750px] bg-slate-50 p-12 text-slate-900"
    style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
  >
    <header className="rounded-[32px] bg-linear-to-br from-indigo-700 to-violet-600 px-10 py-9 text-white shadow-xl">
      <p className="text-[22px] font-bold tracking-[0.22em] text-indigo-100">CLASS NOTICE</p>
      <h1 className="mt-3 text-[42px] font-black leading-tight">{className || '班级空间'}</h1>
      {semester ? <p className="mt-3 text-[22px] text-indigo-100">{semester}</p> : null}
    </header>

    <section className="mt-8 rounded-[32px] border border-slate-200 bg-white px-10 py-10 shadow-lg">
      <div className="flex items-center justify-between gap-4">
        <span className="rounded-full bg-indigo-50 px-5 py-2 text-[20px] font-bold text-indigo-700">
          {NOTICE_LABELS[notice.category]}
        </span>
        <span className="text-[18px] font-medium text-slate-500">
          发布于 {formatShanghaiDateTime(notice.createdAt)}
        </span>
      </div>
      <h2 className="mt-7 text-[38px] font-black leading-[1.25] text-slate-950">{notice.title}</h2>
      <p className="mt-7 whitespace-pre-wrap text-[25px] leading-[1.75] text-slate-700">{notice.content}</p>

      {notice.deadlineAt ? (
        <div className="mt-8 rounded-3xl border border-rose-200 bg-rose-50 px-7 py-6">
          <p className="text-[19px] font-bold tracking-wide text-rose-600">截止时间（北京时间）</p>
          <p className="mt-2 text-[30px] font-black text-rose-900">
            {formatShanghaiDateTime(notice.deadlineAt)}
          </p>
          <p className="mt-2 text-[23px] font-bold text-rose-700">
            {formatCountdown(notice.deadlineAt, generatedAt)}
          </p>
        </div>
      ) : null}

      {notice.attachmentName ? (
        <div className="mt-7 rounded-2xl bg-slate-100 px-6 py-5 text-[21px] font-semibold text-slate-700">
          附件：{notice.attachmentName}
        </div>
      ) : null}

      <div className="mt-9 flex items-center justify-between border-t border-slate-200 pt-6 text-[19px] text-slate-500">
        <span>发布人：{notice.authorName}</span>
        <span>{notice.isPinned ? '班级置顶通知' : '班级通知'}</span>
      </div>
    </section>

    <footer className="px-4 pb-2 pt-7 text-center text-[17px] text-slate-500">
      倒计时为导出时快照 · 生成于 {formatShanghaiDateTime(generatedAt)}
    </footer>
  </article>
);

interface CalendarSharePosterProps {
  entries: CalendarEntry[];
  className: string;
  semester?: string;
  generatedAt: Date;
}

export const CalendarSharePoster: React.FC<CalendarSharePosterProps> = ({
  entries,
  className,
  semester,
  generatedAt
}) => (
  <article
    data-testid="calendar-share-poster"
    className="w-[750px] bg-slate-50 p-12 text-slate-900"
    style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
  >
    <header className="rounded-[32px] bg-linear-to-br from-slate-950 to-indigo-800 px-10 py-9 text-white shadow-xl">
      <p className="text-[22px] font-bold tracking-[0.22em] text-indigo-200">UPCOMING 30 DAYS</p>
      <h1 className="mt-3 text-[42px] font-black leading-tight">{className || '班级空间'} · 近期日程</h1>
      <p className="mt-3 text-[22px] text-indigo-100">{semester || '未来 30 天'} · 共 {entries.length} 项</p>
    </header>

    <div className="mt-8 space-y-5">
      {entries.length === 0 ? (
        <div className="rounded-[28px] border border-slate-200 bg-white px-9 py-12 text-center text-[24px] text-slate-500">
          未来 30 天暂无日程
        </div>
      ) : entries.map((entry) => {
        const countdownTarget = entry.startsAt || shanghaiDateToEndMs(entry.date);
        return (
          <section key={entry.id} className="rounded-[28px] border border-slate-200 bg-white px-8 py-7 shadow-md">
            <div className="flex items-start justify-between gap-5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`rounded-full px-4 py-1.5 text-[17px] font-bold ${
                    entry.source === 'notice'
                      ? 'bg-rose-50 text-rose-700'
                      : 'bg-indigo-50 text-indigo-700'
                  }`}>
                    {EVENT_LABELS[entry.category]}
                  </span>
                  <span className="text-[18px] font-semibold text-slate-500">
                    {entry.startsAt ? formatShanghaiDateTime(entry.startsAt) : entry.date}
                  </span>
                </div>
                <h2 className="mt-4 text-[29px] font-black leading-tight text-slate-950">{entry.title}</h2>
                {entry.description ? (
                  <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-[20px] leading-relaxed text-slate-600">
                    {entry.description}
                  </p>
                ) : null}
                {entry.location ? (
                  <p className="mt-3 text-[19px] font-semibold text-slate-500">地点：{entry.location}</p>
                ) : null}
              </div>
              <span className={`shrink-0 rounded-2xl px-4 py-3 text-[18px] font-black ${
                entry.source === 'notice'
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-100 text-slate-700'
              }`}>
                {formatCountdown(countdownTarget, generatedAt)}
              </span>
            </div>
          </section>
        );
      })}
    </div>

    <footer className="px-4 pb-2 pt-7 text-center text-[17px] text-slate-500">
      倒计时为导出时快照 · 生成于 {formatShanghaiDateTime(generatedAt)}
    </footer>
  </article>
);
