import React, { useState, useEffect, useRef } from 'react';
import { Poll, PollOption } from '../types';
import { 
  subscribeToPolls, 
  addPoll, 
  votePoll, 
  deletePoll 
} from '../services/firestoreService';
import { useAuth } from '../context/AuthContext';
import { 
  Vote, 
  Plus, 
  CheckCircle2, 
  Clock, 
  Trash2, 
  EyeOff, 
  Filter,
  ChevronDown,
  X
} from 'lucide-react';

export const PollModule: React.FC = () => {
  const { profile, isCommittee } = useAuth();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expired'>('all');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New poll form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [isMultiple, setIsMultiple] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [deadline, setDeadline] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribeToPolls((data) => {
      setPolls(data);
    });
    return () => unsub();
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowStatusDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddOptionInput = () => {
    if (options.length < 8) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveOptionInput = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    const validOptions = options.map(o => o.trim()).filter(Boolean);
    if (!title.trim() || validOptions.length < 2 || !profile) return;

    setSubmitting(true);
    try {
      const pollOptions: PollOption[] = validOptions.map((text, idx) => ({
        id: `opt_${Date.now()}_${idx}`,
        text,
        voterUids: []
      }));

      await addPoll({
        title: title.trim(),
        description: description.trim(),
        options: pollOptions,
        isMultiple,
        isAnonymous,
        deadline: deadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        authorUid: profile.uid,
        authorName: profile.name,
        createdAt: new Date().toISOString()
      });

      setTitle('');
      setDescription('');
      setOptions(['', '']);
      setIsMultiple(false);
      setIsAnonymous(false);
      setDeadline('');
      setShowCreateModal(false);
    } catch (err) {
      console.error('Failed to create poll:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (poll: Poll, optionId: string) => {
    if (!profile) return;
    try {
      await votePoll(poll.id, [optionId], profile.uid, poll.options, poll.isMultiple);
    } catch (err) {
      console.error('Vote failed:', err);
    }
  };

  const filteredPolls = polls.filter(poll => {
    const isExpired = poll.deadline ? new Date(poll.deadline).getTime() < new Date().setHours(0,0,0,0) : false;
    if (filterStatus === 'active') return !isExpired;
    if (filterStatus === 'expired') return isExpired;
    return true;
  });

  const statusLabel = filterStatus === 'all' 
    ? `全部投票 (${polls.length})` 
    : filterStatus === 'active' 
      ? `进行中 (${polls.filter(p => !p.deadline || new Date(p.deadline).getTime() >= new Date().setHours(0,0,0,0)).length})` 
      : `已截止 (${polls.filter(p => p.deadline && new Date(p.deadline).getTime() < new Date().setHours(0,0,0,0)).length})`;

  return (
    <div className="space-y-4">
      {/* Header & Clean Controls */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Vote className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            班级民主投票与决策
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            班服定制、活动方案、集体评优等表决投票，实时统计得票分布
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          {/* Status Dropdown Filter - Click to expand */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setShowStatusDropdown(!showStatusDropdown)}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 rounded-xl transition-colors border border-slate-200/60 dark:border-slate-700/60"
            >
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span>{statusLabel}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showStatusDropdown && (
              <div className="absolute right-0 mt-1.5 w-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-1.5 text-xs z-30 animate-in fade-in">
                {[
                  { key: 'all', label: '全部投票' },
                  { key: 'active', label: '进行中' },
                  { key: 'expired', label: '已截止' }
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => {
                      setFilterStatus(item.key as 'all' | 'active' | 'expired');
                      setShowStatusDropdown(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                      filterStatus === item.key
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {isCommittee && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              发起投票
            </button>
          )}
        </div>
      </div>

      {/* Polls List */}
      <div className="space-y-4">
        {filteredPolls.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-6">
            <Vote className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">暂无此状态投票项目</p>
            <p className="text-[11px] text-slate-400 mt-0.5">班委发起新表决后将在此处实时显示</p>
          </div>
        ) : (
          filteredPolls.map((poll) => {
            const totalVotes = poll.options.reduce((sum, opt) => sum + opt.voterUids.length, 0);
            const myVotedOptionIds = poll.options
              .filter(opt => profile && opt.voterUids.includes(profile.uid))
              .map(opt => opt.id);

            const isExpired = poll.deadline ? new Date(poll.deadline).getTime() < new Date().setHours(0,0,0,0) : false;

            return (
              <div
                key={poll.id}
                className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs space-y-3"
              >
                {/* Poll Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                        isExpired
                          ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                      }`}>
                        {isExpired ? '已截止' : '进行中'}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                        {poll.isMultiple ? '多选' : '单选'}
                      </span>
                      {poll.isAnonymous && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 flex items-center gap-1">
                          <EyeOff className="w-2.5 h-2.5" />
                          匿名
                        </span>
                      )}
                    </div>

                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white pt-0.5">
                      {poll.title}
                    </h3>
                    {poll.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        {poll.description}
                      </p>
                    )}
                  </div>

                  {isCommittee && (
                    <button
                      onClick={() => {
                        if (window.confirm('确定要删除此项投票吗？')) {
                          deletePoll(poll.id);
                        }
                      }}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition-colors"
                      title="删除投票"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Options List with Percentage Bars */}
                <div className="space-y-2">
                  {poll.options.map((opt) => {
                    const voteCount = opt.voterUids.length;
                    const percent = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
                    const isMyChoice = myVotedOptionIds.includes(opt.id);

                    return (
                      <div
                        key={opt.id}
                        onClick={() => !isExpired && profile && handleVote(poll, opt.id)}
                        className={`relative overflow-hidden p-3 rounded-xl border transition-all cursor-pointer ${
                          isMyChoice
                            ? 'border-indigo-300 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30'
                            : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100/70'
                        }`}
                      >
                        {/* Progress Fill */}
                        <div
                          className={`absolute top-0 bottom-0 left-0 transition-all duration-300 rounded-xl ${
                            isMyChoice
                              ? 'bg-indigo-200/40 dark:bg-indigo-900/40'
                              : 'bg-slate-200/40 dark:bg-slate-700/30'
                          }`}
                          style={{ width: `${percent}%` }}
                        />

                        {/* Content */}
                        <div className="relative z-10 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                              isMyChoice
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'border-slate-300 bg-white dark:bg-slate-800'
                            }`}>
                              {isMyChoice && <CheckCircle2 className="w-2.5 h-2.5" />}
                            </span>
                            <span className={`font-medium ${isMyChoice ? 'text-indigo-900 dark:text-indigo-200 font-semibold' : 'text-slate-800 dark:text-slate-200'}`}>
                              {opt.text}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[11px]">
                            <span className="text-slate-400 font-medium">{voteCount} 票</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300 w-8 text-right">
                              {percent}%
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer Info */}
                <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <span>发起人：{poll.authorName}</span>
                    <span>累计 {totalVotes} 次投票</span>
                  </div>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    截止：{poll.deadline || '长期有效'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Poll Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" />
                发起班级新投票
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePoll} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  投票标题 *
                </label>
                <input
                  type="text"
                  required
                  placeholder="例如：春季班级篮球对抗赛服装颜色方案"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  补充说明 (选填)
                </label>
                <input
                  type="text"
                  placeholder="例如：请每位同学积极参与，票数最多者为最终方案"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Options */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  投票选项 (至少2项) *
                </label>
                <div className="space-y-2">
                  {options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-semibold w-4">{idx + 1}.</span>
                      <input
                        type="text"
                        required
                        placeholder={`选项 ${idx + 1}`}
                        value={opt}
                        onChange={(e) => {
                          const newOpts = [...options];
                          newOpts[idx] = e.target.value;
                          setOptions(newOpts);
                        }}
                        className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                      />
                      {options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveOptionInput(idx)}
                          className="text-slate-400 hover:text-rose-500 text-xs px-1.5"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  {options.length < 8 && (
                    <button
                      type="button"
                      onClick={handleAddOptionInput}
                      className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1 pt-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      添加更多选项
                    </button>
                  )}
                </div>
              </div>

              {/* Settings: Multi, Anon, Deadline */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isMultiple}
                    onChange={(e) => setIsMultiple(e.target.checked)}
                    className="rounded-md text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  允许每人多选
                </label>

                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    className="rounded-md text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  匿名投票
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  截止日期
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-medium"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs"
                >
                  {submitting ? '创建中...' : '立即发起投票'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
