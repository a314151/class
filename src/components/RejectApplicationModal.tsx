import React, { useEffect, useId, useState } from 'react';
import { MessageSquareText, UserX, X } from 'lucide-react';
import type { UserProfile } from '../types';

interface RejectApplicationModalProps {
  applicant: UserProfile;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}

const MAX_REASON_LENGTH = 300;

export const RejectApplicationModal: React.FC<RejectApplicationModalProps> = ({
  applicant,
  onConfirm,
  onClose
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const titleId = useId();
  const reasonId = useId();
  const errorId = useId();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, submitting]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedReason = reason.trim();
    if (!normalizedReason) {
      setError('请填写拒绝原因，让申请人知道需要修改什么。');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(normalizedReason);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '拒绝申请失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-xs animate-in fade-in"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={error ? errorId : undefined}
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-2xl bg-rose-50 p-2.5 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
            <UserX className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 id={titleId} className="text-base font-bold text-slate-900 dark:text-white">
              拒绝 {applicant.name} 的注册申请
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              学号：{applicant.studentId}。原因会在该同学下次登录时原样显示。
            </p>
          </div>
          <button
            type="button"
            aria-label="关闭拒绝申请弹窗"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div>
          <label htmlFor={reasonId} className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
            <MessageSquareText className="h-4 w-4 text-rose-500" />
            拒绝原因 <span className="text-rose-500">*</span>
          </label>
          <textarea
            id={reasonId}
            autoFocus
            required
            maxLength={MAX_REASON_LENGTH}
            rows={5}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              if (error) setError(null);
            }}
            disabled={submitting}
            placeholder="例如：姓名与学号不匹配，请核对后联系管理员重新申请。"
            className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-rose-400 focus:ring-4 focus:ring-rose-500/10 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <div className="mt-1.5 flex min-h-5 items-start justify-between gap-3">
            <p id={errorId} role={error ? 'alert' : undefined} className="text-xs font-medium text-rose-600 dark:text-rose-400">
              {error}
            </p>
            <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
              {reason.length}/{MAX_REASON_LENGTH}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={submitting || !reason.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <UserX className="h-4 w-4" />
            {submitting ? '正在拒绝...' : '确认拒绝并回复'}
          </button>
        </div>
      </form>
    </div>
  );
};
