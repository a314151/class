import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { BirthdayWish, UserProfile } from '../types';
import { 
  subscribeToBirthdayWishes, 
  sendBirthdayWish, 
  toggleLikeWish, 
  subscribeToUsers 
} from '../services/firestoreService';
import { useAuth } from '../context/AuthContext';
import { 
  Cake, 
  Heart, 
  Sparkles, 
  Send, 
  Calendar, 
  Gift, 
  PartyPopper,
  MessageCircle,
  ChevronDown
} from 'lucide-react';

const WISH_TEMPLATES = [
  '🎂 祝你生日快乐！愿你所念皆如愿，所行皆坦途，学业有成！',
  '✨ 生日快乐！感谢你在班集体中的陪伴与发光发热，永远开心！',
  '🎉 愿新的一岁里，万事顺遂，乘风破浪，金榜题名！',
  '🌟 祝大一岁的大朋友生日快乐！吃好喝好，无忧无虑！',
  '🌸 愿你的未来闪闪发光，每天都有好心情，生日大吉！'
];

export const BirthdayModule: React.FC = () => {
  const { profile } = useAuth();
  const [wishes, setWishes] = useState<BirthdayWish[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [customMsg, setCustomMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);

  const templateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubWishes = subscribeToBirthdayWishes((data) => {
      setWishes(data);
    });
    const unsubUsers = subscribeToUsers((data) => {
      setUsers(data);
      if (data.length > 0 && !selectedUser) {
        setSelectedUser(data[0]);
      }
    });
    return () => {
      unsubWishes();
      unsubUsers();
    };
  }, []);

  // Close template dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (templateRef.current && !templateRef.current.contains(event.target as Node)) {
        setShowTemplateDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fireConfetti = () => {
    confetti({
      particleCount: 60,
      spread: 60,
      origin: { y: 0.6 }
    });
  };

  const handleSendWish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selectedUser || !customMsg.trim()) return;

    setSending(true);
    try {
      await sendBirthdayWish({
        targetUid: selectedUser.uid,
        targetName: selectedUser.name,
        senderUid: profile.uid,
        senderName: profile.name,
        senderAvatar: profile.avatar,
        message: customMsg.trim(),
        createdAt: new Date().toISOString(),
        likes: []
      });
      setCustomMsg('');
      fireConfetti();
    } catch (err) {
      console.error('Failed to send wish:', err);
    } finally {
      setSending(false);
    }
  };

  // Calculate upcoming birthdays
  const getDaysUntilBirthday = (birthdayStr?: string): { days: number; dateFormatted: string } | null => {
    if (!birthdayStr) return null;
    const parts = birthdayStr.split('-');
    if (parts.length < 3) return null;

    const today = new Date();
    const currentYear = today.getFullYear();
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);

    let nextBirthday = new Date(currentYear, month, day);
    if (nextBirthday.getTime() < today.setHours(0, 0, 0, 0)) {
      nextBirthday = new Date(currentYear + 1, month, day);
    }

    const diffTime = nextBirthday.getTime() - today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return {
      days: diffDays,
      dateFormatted: `${parts[1]}月${parts[2]}日`
    };
  };

  const classmatesWithBirthdays = users
    .map(u => ({
      ...u,
      birthdayInfo: getDaysUntilBirthday(u.birthday || '2008-06-15')
    }))
    .sort((a, b) => (a.birthdayInfo?.days || 999) - (b.birthdayInfo?.days || 999));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Cake className="w-4 h-4 text-rose-500" />
            班级生日祝福与温情庆生墙
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            记录同学生日倒计时，送上专属生日贺卡与心愿祝福
          </p>
        </div>

        <button
          onClick={fireConfetti}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 rounded-xl border border-rose-200 dark:border-rose-900/50 transition-colors shrink-0"
        >
          <PartyPopper className="w-3.5 h-3.5 text-rose-500" />
          班级撒花庆生
        </button>
      </div>

      {/* Top Banner: Upcoming Birthday Stars */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {classmatesWithBirthdays.slice(0, 3).map((student) => {
          const isToday = student.birthdayInfo?.days === 0;
          return (
            <div
              key={student.uid}
              className={`p-3.5 rounded-2xl border transition-all ${
                isToday
                  ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60'
                  : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800/80'
              }`}
            >
              <div className="flex items-center gap-3">
                <img
                  src={student.avatar}
                  alt={student.name}
                  className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 object-cover"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {student.name}
                    </h3>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                      isToday
                        ? 'bg-rose-500 text-white'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}>
                      {isToday ? '今日生日' : `${student.birthdayInfo?.days}天后`}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    {student.birthdayInfo?.dateFormatted}
                  </p>
                </div>
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-[10px] text-slate-400">
                  {student.role === 'super_admin' ? '超管' : student.role === 'committee' ? '班委' : '同学'}
                </span>
                <button
                  onClick={() => {
                    setSelectedUser(student);
                    setCustomMsg(`🎂 祝${student.name}生日快乐！学业进步，天天开心，万事顺意！🎉`);
                  }}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-1"
                >
                  <Gift className="w-3 h-3" />
                  送祝福
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Area: Send Card & Wishes Wall */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Wish Composer */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-4 sm:p-5 shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            发送生日贺卡与心愿祝福
          </h3>

          <form onSubmit={handleSendWish} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                选择祝福对象
              </label>
              <select
                value={selectedUser?.uid || ''}
                onChange={(e) => {
                  const target = users.find(u => u.uid === e.target.value);
                  if (target) setSelectedUser(target);
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              >
                {users.map(u => (
                  <option key={u.uid} value={u.uid}>
                    {u.name} ({u.studentId ? `学号: ${u.studentId}` : '同学'})
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Wish Template as Expandable Dropdown */}
            <div className="relative" ref={templateRef}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  祝福语模板
                </label>
                <button
                  type="button"
                  onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                  className="inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                >
                  <span>选择快捷寄语模板</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>

              {showTemplateDropdown && (
                <div className="absolute left-0 right-0 top-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-1.5 text-xs z-30 space-y-1 animate-in fade-in">
                  {WISH_TEMPLATES.map((tmpl, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setCustomMsg(tmpl);
                        setShowTemplateDropdown(false);
                      }}
                      className="w-full text-left p-2 rounded-lg text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      {tmpl}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                你的祝福寄语 *
              </label>
              <textarea
                required
                rows={3}
                placeholder="写下你最真挚的心愿祝福..."
                value={customMsg}
                onChange={(e) => setCustomMsg(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-rose-400 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={sending || !customMsg.trim()}
              className="w-full py-2 px-3 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              {sending ? '发送中...' : '送上祝福并在黑板张贴'}
            </button>
          </form>
        </div>

        {/* Right: Birthday Wishes Wall */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5 text-indigo-500" />
              实时班级祝福墙 ({wishes.length})
            </h3>
            <span className="text-[11px] text-slate-400">实时同步</span>
          </div>

          {wishes.length === 0 ? (
            <div className="text-center py-10 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-6">
              <Cake className="w-7 h-7 mx-auto text-rose-300 mb-1.5" />
              <p className="text-xs text-slate-500">快来为即将过生日的同学送上第一条暖心祝福吧！</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-0.5 scrollbar-none">
              {wishes.map((wish) => {
                const hasLiked = profile ? wish.likes?.includes(profile.uid) : false;
                const likesCount = wish.likes?.length || 0;
                return (
                  <div
                    key={wish.id}
                    className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <img
                          src={wish.senderAvatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=student'}
                          alt={wish.senderName}
                          className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 object-cover"
                        />
                        <div className="text-xs">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {wish.senderName}
                          </span>
                          <span className="text-slate-400 mx-1">致</span>
                          <span className="font-semibold text-rose-600 dark:text-rose-400">
                            @{wish.targetName}
                          </span>
                        </div>
                      </div>

                      <span className="text-[10px] text-slate-400">
                        {new Date(wish.createdAt).toLocaleString('zh-CN', {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                      {wish.message}
                    </p>

                    <div className="flex items-center justify-end mt-1.5">
                      <button
                        onClick={() => profile && toggleLikeWish(wish.id, profile.uid, !!hasLiked)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md transition-colors ${
                          hasLiked
                            ? 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 font-semibold'
                            : 'text-slate-400 hover:text-rose-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Heart className={`w-3 h-3 ${hasLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
                        <span>{likesCount > 0 ? likesCount : '点赞'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
