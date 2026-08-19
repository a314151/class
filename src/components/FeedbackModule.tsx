import React, { useState, useEffect, useRef } from 'react';
import { FeedbackItem, FeedbackCategory, FeedbackStatus } from '../types';
import { 
  subscribeToFeedbacks, 
  addFeedback, 
  updateFeedbackStatus, 
  deleteFeedback 
} from '../services/firestoreService';
import { useAuth } from '../context/AuthContext';
import { ConfirmModal } from './ConfirmModal';
import { 
  Inbox, 
  Plus, 
  ShieldCheck, 
  EyeOff, 
  Filter,
  ChevronDown,
  Trash2,
  X
} from 'lucide-react';

const CATEGORY_MAP: Record<FeedbackCategory, string> = {
  teaching: '教学建议',
  management: '班务管理',
  activity: '活动建议',
  life: '生活互助',
  other: '其他心声'
};

const STATUS_MAP: Record<FeedbackStatus, { label: string; badge: string }> = {
  pending: { label: '待处理', badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' },
  processing: { label: '推进中', badge: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300' },
  resolved: { label: '已解决', badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' }
};

export const FeedbackModule: React.FC = () => {
  const { profile, isCommittee } = useAuth();
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [feedbackToDelete, setFeedbackToDelete] = useState<FeedbackItem | null>(null);

  // New feedback
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<FeedbackCategory>('management');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Reply modal
  const [replyingItem, setReplyingItem] = useState<FeedbackItem | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyStatus, setReplyStatus] = useState<FeedbackStatus>('resolved');

  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribeToFeedbacks((data) => {
      setFeedbacks(data);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || !profile) return;

    setSubmitting(true);
    try {
      await addFeedback({
        title: title.trim(),
        content: content.trim(),
        category,
        isAnonymous,
        authorUid: profile.uid,
        authorName: isAnonymous ? '匿名同学' : profile.name,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      setTitle('');
      setContent('');
      setIsAnonymous(false);
      setShowSubmitModal(false);
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyingItem || !profile) return;

    try {
      await updateFeedbackStatus(
        replyingItem.id, 
        replyStatus, 
        replyText.trim() || undefined,
        profile.name
      );
      setReplyingItem(null);
      setReplyText('');
    } catch (err) {
      console.error('Failed to reply:', err);
    }
  };

  const filteredFeedbacks = selectedCategory === 'all'
    ? feedbacks
    : feedbacks.filter(f => f.category === selectedCategory);

  const categoryLabel = selectedCategory === 'all'
    ? `全部类型 (${feedbacks.length})`
    : `${CATEGORY_MAP[selectedCategory as FeedbackCategory] || selectedCategory} (${feedbacks.filter(f => f.category === selectedCategory).length})`;

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Inbox className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            班级意见箱与建议心声
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            倾听同学声音，支持实名或匿名投递，班委实时跟进答复
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          {/* Category Dropdown Filter */}
          <div className="relative" ref={filterRef}>
            <button
              type="button"
              onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 rounded-xl transition-colors border border-slate-200/60 dark:border-slate-700/60"
            >
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span>{categoryLabel}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showCategoryDropdown && (
              <div className="absolute right-0 mt-1.5 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-1.5 text-xs z-30 animate-in fade-in">
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
                  <span>全部类型</span>
                  <span className="text-[10px] text-slate-400">{feedbacks.length}</span>
                </button>
                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                {Object.entries(CATEGORY_MAP).map(([key, label]) => {
                  const count = feedbacks.filter(f => f.category === key).length;
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
                      <span>{label}</span>
                      <span className="text-[10px] text-slate-400">{count}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            onClick={() => setShowSubmitModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            投递建议
          </button>
        </div>
      </div>

      {/* Feedbacks Stream */}
      <div className="space-y-3">
        {filteredFeedbacks.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-6">
            <Inbox className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">暂无相关意见反馈</p>
            <p className="text-[11px] text-slate-400 mt-0.5">期待听到你对班级建设的任何想法与建议</p>
          </div>
        ) : (
          filteredFeedbacks.map((item) => {
            const statusInfo = STATUS_MAP[item.status] || STATUS_MAP.pending;

            return (
              <div
                key={item.id}
                className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs space-y-2.5 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${statusInfo.badge}`}>
                        {statusInfo.label}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {CATEGORY_MAP[item.category]}
                      </span>
                      {item.isAnonymous && (
                        <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                          <EyeOff className="w-3 h-3" />
                          匿名
                        </span>
                      )}
                    </div>

                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white pt-0.5">
                      {item.title}
                    </h3>
                  </div>

                  {isCommittee && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => {
                          setReplyingItem(item);
                          setReplyText(item.reply || '');
                          setReplyStatus(item.status);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 rounded-lg transition-colors"
                      >
                        处理/答复
                      </button>
                      <button
                        onClick={() => setFeedbackToDelete(item)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition-colors"
                        title="删除反馈"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  {item.content}
                </p>

                {/* Reply section if answered */}
                {item.reply && (
                  <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-900 dark:text-indigo-200">
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        班委答复 ({item.replyAuthor || '班委团队'})
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {item.repliedAt && new Date(item.repliedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-indigo-950 dark:text-indigo-100 leading-relaxed">
                      {item.reply}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span>投递者：{item.isAnonymous ? '匿名同学' : item.authorName}</span>
                  <span>{new Date(item.createdAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Submit Feedback Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" />
                投递班级建议与心声
              </h3>
              <button
                onClick={() => setShowSubmitModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitFeedback} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  建议标题 *
                </label>
                <input
                  type="text"
                  required
                  placeholder="例如：关于自习课纪律 / 班级饮水机维护"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    分类
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    {Object.entries(CATEGORY_MAP).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isAnonymous}
                      onChange={(e) => setIsAnonymous(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    />
                    匿名投递 (隐藏姓名)
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  详细建议内容 *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="畅所欲言，提出你的具体想法和改进建议..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 resize-none focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs"
                >
                  {submitting ? '投递中...' : '确认投递'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reply Modal */}
      {replyingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                班委答复 · {replyingItem.title}
              </h3>
              <button
                onClick={() => setReplyingItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendReply} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  处理状态
                </label>
                <select
                  value={replyStatus}
                  onChange={(e) => setReplyStatus(e.target.value as FeedbackStatus)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="pending">待处理</option>
                  <option value="processing">推进中</option>
                  <option value="resolved">已解决</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  答复与解决方案
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="写明班委团队的处理措施、反馈结果或整改方案..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 resize-none focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setReplyingItem(null)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs"
                >
                  保存并公开答复
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={Boolean(feedbackToDelete)}
        title="确认删除该条意见反馈？"
        message={`确定要删除 "${feedbackToDelete?.title}" 吗？删除后此反馈和答复将从系统中清除。`}
        confirmText="确认删除"
        onConfirm={async () => {
          if (feedbackToDelete) {
            await deleteFeedback(feedbackToDelete.id);
          }
        }}
        onClose={() => setFeedbackToDelete(null)}
      />
    </div>
  );
};
