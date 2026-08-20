import React, { useCallback, useState, useEffect, useRef } from 'react';
import { 
  ClassSettings,
  Notice, 
  NoticeCategory 
} from '../types';
import { 
  subscribeToNotices, 
  addNotice, 
  deleteNotice, 
  markNoticeAsRead 
} from '../services/firestoreService';
import { useAuth } from '../context/AuthContext';
import { R2UploadButton } from './R2UploadButton';
import { ConfirmModal } from './ConfirmModal';
import {
  NoticeSharePoster,
  PosterExportHost,
  type PosterExportJob
} from './SharePosters';
import {
  formatCountdown,
  formatShanghaiDateTime,
  shanghaiLocalInputToIso
} from '../lib/dateTime';
import { 
  Bell, 
  Pin, 
  Plus, 
  CheckCircle, 
  Trash2, 
  Paperclip, 
  Megaphone,
  ChevronDown,
  X,
  Search,
  Filter,
  Share2,
  Sparkles,
  CalendarClock
} from 'lucide-react';

const CATEGORY_MAP: Record<NoticeCategory, { label: string; text: string; bg: string }> = {
  urgent: { label: '紧急加急', text: 'text-rose-700 dark:text-rose-300', bg: 'bg-rose-50 dark:bg-rose-950/40' },
  exam: { label: '考试安排', text: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-950/40' },
  activity: { label: '班级活动', text: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
  fee: { label: '费用通知', text: 'text-orange-700 dark:text-orange-300', bg: 'bg-orange-50 dark:bg-orange-950/40' },
  holiday: { label: '放假安排', text: 'text-sky-700 dark:text-sky-300', bg: 'bg-sky-50 dark:bg-sky-950/40' },
  academic: { label: '学术研讨', text: 'text-indigo-700 dark:text-indigo-300', bg: 'bg-indigo-50 dark:bg-indigo-950/40' },
  routine: { label: '日常事务', text: 'text-slate-700 dark:text-slate-300', bg: 'bg-slate-100 dark:bg-slate-800' },
};

const AiImportModal = React.lazy(() => import('./AiImportModal').then((module) => ({ default: module.AiImportModal })));

interface NoticeModuleProps {
  settings: ClassSettings;
}

const safeFilePart = (value: string) => value.replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 50);

export const NoticeModule: React.FC<NoticeModuleProps> = ({ settings }) => {
  const { profile, isCommittee } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAiImport, setShowAiImport] = useState(false);
  const [noticeToDelete, setNoticeToDelete] = useState<Notice | null>(null);
  const [posterJob, setPosterJob] = useState<PosterExportJob | null>(null);
  const [exportingNoticeId, setExportingNoticeId] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState('');
  const [now, setNow] = useState(() => Date.now());

  // New Notice form
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<NoticeCategory>('routine');
  const [isPinned, setIsPinned] = useState(false);
  const [deadlineLocal, setDeadlineLocal] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribeToNotices((data) => {
      setNotices(data);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || !profile) return;

    setSubmitting(true);
    try {
      await addNotice({
        title: title.trim(),
        content: content.trim(),
        category,
        isPinned,
        authorName: profile.name,
        authorUid: profile.uid,
        readBy: [profile.uid],
        createdAt: new Date().toISOString(),
        deadlineAt: deadlineLocal ? shanghaiLocalInputToIso(deadlineLocal) : undefined,
        attachmentUrl: attachmentUrl || undefined,
        attachmentName: attachmentName || undefined,
      });
      setTitle('');
      setContent('');
      setCategory('routine');
      setIsPinned(false);
      setDeadlineLocal('');
      setAttachmentUrl('');
      setAttachmentName('');
      setShowCreateModal(false);
    } catch (err) {
      console.error('Failed to create notice:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredNotices = notices.filter(n => {
    const matchCat = selectedCategory === 'all' || n.category === selectedCategory;
    const matchSearch = !searchQuery.trim() || 
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      n.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  const currentCategoryLabel = selectedCategory === 'all' 
    ? `全部通知 (${notices.length})` 
    : `${CATEGORY_MAP[selectedCategory as NoticeCategory]?.label || selectedCategory} (${notices.filter(n => n.category === selectedCategory).length})`;

  const handlePosterComplete = useCallback((result: 'shared' | 'downloaded' | 'cancelled') => {
    setShareMessage(result === 'shared' ? '已打开系统分享面板' : result === 'downloaded' ? '长图已下载' : '已取消分享');
    setPosterJob(null);
    setExportingNoticeId(null);
  }, []);

  const handlePosterError = useCallback((message: string) => {
    setShareMessage(message);
    setPosterJob(null);
    setExportingNoticeId(null);
  }, []);

  const handleShareNotice = (notice: Notice) => {
    const generatedAt = new Date();
    setShareMessage('正在生成长图…');
    setExportingNoticeId(notice.id);
    setPosterJob({
      id: `${notice.id}-${generatedAt.getTime()}`,
      fileName: `${safeFilePart(notice.title || '班级通知')}.png`,
      title: notice.title,
      text: notice.deadlineAt
        ? `${notice.title}，截止时间 ${formatShanghaiDateTime(notice.deadlineAt)}`
        : notice.title,
      content: (
        <NoticeSharePoster
          notice={notice}
          className={settings.className}
          semester={settings.semester}
          generatedAt={generatedAt}
        />
      )
    });
  };

  return (
    <div className="space-y-4">
      {/* Header & Clean Minimal Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            重要通知公告
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            班级实时重要事项、教务通知与重要日程推送
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Category Dropdown List - Click to expand */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 rounded-xl transition-colors border border-slate-200/60 dark:border-slate-700/60"
            >
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span>{currentCategoryLabel}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showCategoryDropdown && (
              <div className="absolute right-0 mt-1.5 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-1.5 text-xs z-30 animate-in fade-in">
                <button
                  onClick={() => {
                    setSelectedCategory('all');
                    setShowCategoryDropdown(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                    selectedCategory === 'all'
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>全部通知</span>
                  <span className="text-[10px] text-slate-400">{notices.length}</span>
                </button>
                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                {Object.entries(CATEGORY_MAP).map(([key, info]) => {
                  const count = notices.filter(n => n.category === key).length;
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setSelectedCategory(key);
                        setShowCategoryDropdown(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                        selectedCategory === key
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${info.text.replace('text-', 'bg-')}`} />
                        {info.label}
                      </span>
                      <span className="text-[10px] text-slate-400">{count}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-40">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="搜索通知..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Create Button */}
          {isCommittee && (
            <>
              <button
                type="button"
                onClick={() => setShowAiImport(true)}
                className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-1.5 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-100 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-300"
              >
                <Sparkles className="h-3.5 w-3.5" />
                AI 导入
              </button>
              <button
                id="publish-notice-btn"
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                发布通知
              </button>
            </>
          )}
        </div>
      </div>

      {shareMessage ? (
        <div role="status" className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-300">
          {shareMessage}
        </div>
      ) : null}

      {/* Notices List */}
      <div className="space-y-3">
        {filteredNotices.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-6">
            <Bell className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">暂无此分类通知</p>
            <p className="text-[11px] text-slate-400 mt-0.5">有新通知时将在此处实时显示</p>
          </div>
        ) : (
          filteredNotices.map((notice) => {
            const hasRead = profile ? notice.readBy?.includes(profile.uid) : false;
            const catInfo = CATEGORY_MAP[notice.category] || CATEGORY_MAP.routine;
            const formattedDate = new Date(notice.createdAt).toLocaleString('zh-CN', {
              month: 'numeric',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });

            return (
              <div
                key={notice.id}
                id={`notice-card-${notice.id}`}
                className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                  notice.isPinned
                    ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200/70 dark:border-amber-900/40'
                    : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {/* Top badges & actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    {notice.isPinned && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-500 text-white">
                        <Pin className="w-2.5 h-2.5" />
                        置顶
                      </span>
                    )}
                    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-md ${catInfo.bg} ${catInfo.text}`}>
                      {catInfo.label}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {formattedDate}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleShareNotice(notice)}
                      disabled={exportingNoticeId === notice.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      title="生成长图并分享"
                    >
                      <Share2 className="h-3 w-3" />
                      {exportingNoticeId === notice.id ? '生成中' : '分享长图'}
                    </button>
                    {profile && (
                      <button
                        onClick={() => markNoticeAsRead(notice.id, profile.uid)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-lg transition-colors border ${
                          hasRead
                            ? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50'
                            : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/50 font-semibold'
                        }`}
                      >
                        <CheckCircle className="w-3 h-3" />
                        {hasRead ? `已阅 (${notice.readBy?.length || 1})` : '确认已阅'}
                      </button>
                    )}

                    {isCommittee && (
                      <button
                        onClick={() => setNoticeToDelete(notice)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition-colors"
                        title="删除通知"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Title */}
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mb-1.5">
                  {notice.title}
                </h3>

                {/* Content */}
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line mb-3">
                  {notice.content}
                </p>

                {notice.deadlineAt && (
                  <div className={`mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 ${
                    Date.parse(notice.deadlineAt) > now
                      ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300'
                      : 'border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold">
                      <CalendarClock className="h-3.5 w-3.5" />
                      DDL：{formatShanghaiDateTime(notice.deadlineAt)}
                    </span>
                    <span className="text-xs font-black">{formatCountdown(notice.deadlineAt, now)}</span>
                  </div>
                )}

                {/* Attachment if present */}
                {notice.attachmentUrl && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <a
                      href={notice.attachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700"
                    >
                      <Paperclip className="w-3 h-3" />
                      附件：{notice.attachmentName || '查看附件'}
                    </a>
                  </div>
                )}

                {/* Author footer */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
                  <span>发布人：{notice.authorName}</span>
                  {notice.readBy && notice.readBy.length > 0 && (
                    <span>全班已阅 {notice.readBy.length} 人</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Notice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" />
                发布班级新通知
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNotice} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  通知标题 *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例如：关于本周五期中模拟考试考场安排通知"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    通知分类
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as NoticeCategory)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    {Object.entries(CATEGORY_MAP).map(([key, info]) => (
                      <option key={key} value={key}>{info.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300 select-none">
                    <input
                      type="checkbox"
                      checked={isPinned}
                      onChange={(e) => setIsPinned(e.target.checked)}
                      className="w-4 h-4 rounded-md text-indigo-600 focus:ring-indigo-500 border-slate-300"
                    />
                    <span>置顶显示在通知列表最前</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <CalendarClock className="h-3.5 w-3.5 text-rose-500" />
                  DDL（选填，北京时间）
                </label>
                <input
                  type="datetime-local"
                  value={deadlineLocal}
                  onChange={(e) => setDeadlineLocal(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  通知详细内容 *
                </label>
                <textarea
                  required
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="详细说明通知事项、时间节点、考场注意事项或活动流程..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  附件上传 (可选)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={attachmentUrl}
                    onChange={(e) => setAttachmentUrl(e.target.value)}
                    placeholder="可粘贴附件/网盘链接，或使用右侧上传"
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                  <R2UploadButton
                    onUploaded={(url, name) => {
                      setAttachmentUrl(url);
                      setAttachmentName(name);
                    }}
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors font-medium"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition-colors shadow-xs"
                >
                  {submitting ? '发布中...' : '确认发布'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={Boolean(noticeToDelete)}
        title="确认删除该通知？"
        message={`删除后该通知 "${noticeToDelete?.title}" 将无法恢复，班级同学将不再可见。`}
        confirmText="确认删除"
        onConfirm={async () => {
          if (noticeToDelete) {
            await deleteNotice(noticeToDelete.id);
          }
        }}
        onClose={() => setNoticeToDelete(null)}
      />
      {showAiImport ? (
        <React.Suspense fallback={null}>
          <AiImportModal isOpen onClose={() => setShowAiImport(false)} defaultTarget="notice" />
        </React.Suspense>
      ) : null}
      <PosterExportHost
        job={posterJob}
        onComplete={handlePosterComplete}
        onError={handlePosterError}
      />
    </div>
  );
};
