import React, { useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { BirthdayWish, UserProfile } from '../types';
import {
  subscribeToBirthdayWishes,
  sendBirthdayWish,
  updateBirthdayWish,
  toggleLikeWish,
  deleteBirthdayWish,
  subscribeToUsers
} from '../services/firestoreService';
import { useAuth } from '../context/AuthContext';
import { ConfirmModal } from './ConfirmModal';
import {
  ArrowRight,
  Cake,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Gift,
  Heart,
  MessageCircle,
  PartyPopper,
  Pencil,
  Send,
  Sparkles,
  Trash2,
  Users,
  X
} from 'lucide-react';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const WISH_TEMPLATES = [
  '🎂 祝你生日快乐！愿你所念皆如愿，所行皆坦途，学业有成！',
  '✨ 生日快乐！感谢你在班集体中的陪伴与发光发热，永远开心！',
  '🎉 愿新的一岁里，万事顺遂，乘风破浪，金榜题名！',
  '🌟 祝大一岁的大朋友生日快乐！吃好喝好，无忧无虑！',
  '🌸 愿你的未来闪闪发光，每天都有好心情，生日大吉！'
];

const CELEBRATION_PARTICLES = Array.from({ length: 28 }, (_, index) => ({
  emoji: ['🎉', '✨', '🎂', '🎈', '💖', '🌟', '🎁'][index % 7],
  left: (index * 37) % 96,
  delay: (index % 9) * 0.08,
  duration: 1.9 + (index % 5) * 0.22
}));

interface BirthdayInfo {
  daysUntil: number;
  daysSince: number;
  dateFormatted: string;
}

type BirthdayEntry = UserProfile & { birthdayInfo: BirthdayInfo };

const getLocalDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getBirthdayInfo = (birthday: string | undefined, todayKey: string): BirthdayInfo | null => {
  if (!birthday) return null;

  const parts = birthday.split('-');
  if (parts.length !== 3) return null;

  const month = Number(parts[1]);
  const day = Number(parts[2]);
  const validationDate = new Date(Date.UTC(2000, month - 1, day));
  if (
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    validationDate.getUTCMonth() !== month - 1 ||
    validationDate.getUTCDate() !== day
  ) {
    return null;
  }

  const [todayYear, todayMonth, todayDay] = todayKey.split('-').map(Number);
  const todayNumber = Date.UTC(todayYear, todayMonth - 1, todayDay);

  let nextBirthdayNumber = Date.UTC(todayYear, month - 1, day);
  if (nextBirthdayNumber < todayNumber) {
    nextBirthdayNumber = Date.UTC(todayYear + 1, month - 1, day);
  }

  let lastBirthdayNumber = Date.UTC(todayYear, month - 1, day);
  if (lastBirthdayNumber > todayNumber) {
    lastBirthdayNumber = Date.UTC(todayYear - 1, month - 1, day);
  }

  return {
    daysUntil: Math.round((nextBirthdayNumber - todayNumber) / DAY_IN_MS),
    daysSince: Math.round((todayNumber - lastBirthdayNumber) / DAY_IN_MS),
    dateFormatted: `${month}月${day}日`
  };
};

const formatWishTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '时间未知';
  return date.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const BirthdayModule: React.FC = () => {
  const { profile, isCommittee } = useAuth();
  const [wishes, setWishes] = useState<BirthdayWish[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [todayKey, setTodayKey] = useState(() => getLocalDateKey(new Date()));
  const [featuredUid, setFeaturedUid] = useState('');
  const [selectedUid, setSelectedUid] = useState('');
  const [customMsg, setCustomMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [wishToDelete, setWishToDelete] = useState<BirthdayWish | null>(null);
  const [editingWishId, setEditingWishId] = useState<string | null>(null);
  const [editMessage, setEditMessage] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [actionError, setActionError] = useState('');
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationName, setCelebrationName] = useState('');

  const templateRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const celebrationTimersRef = useRef<number[]>([]);

  useEffect(() => {
    const unsubWishes = subscribeToBirthdayWishes(setWishes);
    const unsubUsers = subscribeToUsers(setUsers);
    return () => {
      unsubWishes();
      unsubUsers();
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const nextTodayKey = getLocalDateKey(new Date());
      setTodayKey((current) => current === nextTodayKey ? current : nextTodayKey);
    }, 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (templateRef.current && !templateRef.current.contains(event.target as Node)) {
        setShowTemplateDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => () => {
    celebrationTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    confetti.reset();
  }, []);

  const birthdayEntries = useMemo<BirthdayEntry[]>(() => users
    .map((user) => {
      const birthdayInfo = getBirthdayInfo(user.birthday, todayKey);
      return birthdayInfo ? { ...user, birthdayInfo } : null;
    })
    .filter((user): user is BirthdayEntry => user !== null)
    .sort((a, b) => a.birthdayInfo.daysUntil - b.birthdayInfo.daysUntil || a.name.localeCompare(b.name, 'zh-CN')),
  [todayKey, users]);

  const featuredBirthdayGroup = useMemo(() => {
    const todayBirthdays = birthdayEntries.filter((user) => user.birthdayInfo.daysUntil === 0);
    if (todayBirthdays.length > 0) return todayBirthdays;
    if (birthdayEntries.length === 0) return [];

    const nearestDaysSince = Math.min(...birthdayEntries.map((user) => user.birthdayInfo.daysSince));
    return birthdayEntries
      .filter((user) => user.birthdayInfo.daysSince === nearestDaysSince)
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  }, [birthdayEntries]);

  const upcomingWeek = useMemo(() => birthdayEntries.filter((user) => (
    user.birthdayInfo.daysUntil >= 1 && user.birthdayInfo.daysUntil <= 7
  )), [birthdayEntries]);

  useEffect(() => {
    setFeaturedUid((current) => (
      featuredBirthdayGroup.some((user) => user.uid === current)
        ? current
        : featuredBirthdayGroup[0]?.uid || ''
    ));
  }, [featuredBirthdayGroup]);

  const featuredUser = featuredBirthdayGroup.find((user) => user.uid === featuredUid)
    || featuredBirthdayGroup[0]
    || null;

  useEffect(() => {
    setSelectedUid((current) => {
      if (current && users.some((user) => user.uid === current)) return current;
      return featuredUser?.uid || birthdayEntries[0]?.uid || users[0]?.uid || '';
    });
  }, [birthdayEntries, featuredUser?.uid, users]);

  const selectedUser = users.find((user) => user.uid === selectedUid) || null;
  const featuredWishes = useMemo(() => (
    featuredUser ? wishes.filter((wish) => wish.targetUid === featuredUser.uid) : []
  ), [featuredUser, wishes]);

  const fireCelebration = (name?: string) => {
    celebrationTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    celebrationTimersRef.current = [];
    confetti.reset();

    setCelebrationName(name || featuredUser?.name || '今天的寿星');
    setShowCelebration(true);

    const schedule = (callback: () => void, delay: number) => {
      const timerId = window.setTimeout(callback, delay);
      celebrationTimersRef.current.push(timerId);
    };

    const colors = ['#fb7185', '#fbbf24', '#a78bfa', '#38bdf8', '#34d399', '#f472b6'];
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    confetti({
      particleCount: reducedMotion ? 35 : 95,
      spread: reducedMotion ? 50 : 90,
      startVelocity: reducedMotion ? 24 : 42,
      origin: { x: 0.5, y: 0.62 },
      colors,
      scalar: 1.05
    });

    if (!reducedMotion) {
      schedule(() => confetti({
        particleCount: 55,
        angle: 60,
        spread: 72,
        startVelocity: 52,
        origin: { x: 0, y: 0.72 },
        colors
      }), 180);
      schedule(() => confetti({
        particleCount: 55,
        angle: 120,
        spread: 72,
        startVelocity: 52,
        origin: { x: 1, y: 0.72 },
        colors
      }), 260);
      schedule(() => confetti({
        particleCount: 75,
        spread: 125,
        startVelocity: 34,
        gravity: 0.75,
        origin: { x: 0.5, y: 0.35 },
        colors,
        scalar: 0.9
      }), 620);
      schedule(() => confetti({
        particleCount: 45,
        spread: 360,
        startVelocity: 24,
        ticks: 120,
        origin: { x: 0.25, y: 0.42 },
        colors
      }), 980);
      schedule(() => confetti({
        particleCount: 45,
        spread: 360,
        startVelocity: 24,
        ticks: 120,
        origin: { x: 0.75, y: 0.42 },
        colors
      }), 1120);
    }

    schedule(() => setShowCelebration(false), reducedMotion ? 1800 : 3200);
  };

  const openComposerFor = (user: UserProfile) => {
    setSelectedUid(user.uid);
    setCustomMsg(`🎂 祝${user.name}生日快乐！愿新的一岁闪闪发光，天天开心，万事顺意！🎉`);
    setActionError('');
    if (window.innerWidth < 1024) {
      window.setTimeout(() => composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }
  };

  const handleSendWish = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile || !selectedUser || !customMsg.trim()) return;

    setSending(true);
    setActionError('');
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
      fireCelebration(selectedUser.name);
    } catch (error) {
      console.error('Failed to send wish:', error);
      setActionError('祝福发送失败，请检查网络后重试。');
    } finally {
      setSending(false);
    }
  };

  const startEditingWish = (wish: BirthdayWish) => {
    setEditingWishId(wish.id);
    setEditMessage(wish.message);
    setActionError('');
  };

  const handleSaveEdit = async (wish: BirthdayWish) => {
    const nextMessage = editMessage.trim();
    if (!nextMessage || nextMessage === wish.message) {
      setEditingWishId(null);
      return;
    }

    setSavingEdit(true);
    setActionError('');
    try {
      await updateBirthdayWish(wish.id, nextMessage);
      setEditingWishId(null);
      setEditMessage('');
    } catch (error) {
      console.error('Failed to update wish:', error);
      setActionError('祝福修改失败，请稍后重试。');
    } finally {
      setSavingEdit(false);
    }
  };

  const isBirthdayToday = featuredUser?.birthdayInfo.daysUntil === 0;

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-rose-500">
            <Sparkles className="h-3.5 w-3.5" />
            Birthday moments
          </div>
          <h2 className="text-xl font-black tracking-tight text-slate-950 dark:text-white sm:text-2xl">
            班级生日庆祝空间
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            为最近的寿星保留一块专属主场，也提前记住未来七天的特别日子。
          </p>
        </div>
        <button
          type="button"
          onClick={() => fireCelebration()}
          className="inline-flex w-fit items-center gap-2 rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-bold text-rose-600 shadow-sm transition hover:-translate-y-0.5 hover:border-rose-300 hover:shadow-md dark:border-rose-900/70 dark:bg-slate-900 dark:text-rose-300"
        >
          <PartyPopper className="h-4 w-4" />
          为主角放礼花
        </button>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="relative min-h-[280px] overflow-hidden rounded-[28px] border border-rose-200/70 bg-gradient-to-br from-rose-50 via-fuchsia-50 to-amber-50 p-5 shadow-sm dark:border-rose-900/50 dark:from-rose-950/50 dark:via-fuchsia-950/30 dark:to-amber-950/20 sm:p-7">
          <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-rose-300/30 blur-3xl dark:bg-rose-600/15" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-amber-300/30 blur-3xl dark:bg-amber-500/10" />
          <div className="pointer-events-none absolute right-8 top-6 text-6xl opacity-10 sm:text-8xl">🎂</div>

          {featuredUser ? (
            <div className="relative z-10 flex h-full flex-col justify-between gap-6">
              <div className="flex items-center justify-between gap-3">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black ${
                  isBirthdayToday
                    ? 'bg-rose-500 text-white shadow-md shadow-rose-300/40'
                    : 'border border-white/80 bg-white/70 text-rose-700 backdrop-blur dark:border-white/10 dark:bg-slate-950/40 dark:text-rose-300'
                }`}>
                  <Cake className="h-3.5 w-3.5" />
                  {isBirthdayToday ? '今天生日 · 全班庆祝中' : '最近一位寿星'}
                </span>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {featuredUser.birthdayInfo.dateFormatted}
                </span>
              </div>

              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="relative w-fit shrink-0">
                  <div className="absolute -inset-2 rounded-[26px] bg-gradient-to-br from-rose-400 via-fuchsia-400 to-amber-300 opacity-60 blur-md" />
                  <img
                    src={featuredUser.avatar}
                    alt={featuredUser.name}
                    className="relative h-24 w-24 rounded-[22px] border-4 border-white bg-white object-cover shadow-xl dark:border-slate-900 sm:h-28 sm:w-28"
                  />
                  <span className="absolute -bottom-2 -right-2 grid h-10 w-10 place-items-center rounded-2xl border-4 border-white bg-amber-400 text-xl shadow-lg dark:border-slate-900">
                    👑
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-rose-600 dark:text-rose-300">
                    {isBirthdayToday
                      ? '今天，请把所有好心情都送给 TA'
                      : `${featuredUser.birthdayInfo.daysSince} 天前刚刚度过生日`}
                  </p>
                  <h3 className="mt-1 truncate text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                    {featuredUser.name}
                  </h3>
                  <p className="mt-2 max-w-xl text-xs leading-6 text-slate-600 dark:text-slate-300">
                    {isBirthdayToday
                      ? '愿新的一岁被鲜花、掌声与真诚环绕。班级祝福墙正在实时收集大家的心意。'
                      : '生日虽已过去，祝福不会过期。这里继续为最近的寿星保留专属祝福与回忆。'}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openComposerFor(featuredUser)}
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-rose-600 dark:bg-white dark:text-slate-950 dark:hover:bg-rose-200"
                    >
                      <Gift className="h-4 w-4" />
                      写一份专属祝福
                    </button>
                    <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/80 bg-white/60 px-3 py-2 text-[11px] font-semibold text-slate-600 backdrop-blur dark:border-white/10 dark:bg-slate-950/30 dark:text-slate-300">
                      <MessageCircle className="h-3.5 w-3.5 text-rose-500" />
                      已收到 {featuredWishes.length} 份祝福
                    </span>
                  </div>
                </div>
              </div>

              {featuredBirthdayGroup.length > 1 && (
                <div className="flex flex-wrap items-center gap-2 border-t border-rose-200/60 pt-4 dark:border-rose-900/50">
                  <span className="mr-1 text-[11px] font-semibold text-slate-500">同日寿星</span>
                  {featuredBirthdayGroup.map((user) => (
                    <button
                      type="button"
                      key={user.uid}
                      onClick={() => setFeaturedUid(user.uid)}
                      className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-bold transition ${
                        featuredUser.uid === user.uid
                          ? 'border-rose-400 bg-rose-500 text-white'
                          : 'border-white/80 bg-white/60 text-slate-600 hover:border-rose-300 dark:border-white/10 dark:bg-slate-950/30 dark:text-slate-300'
                      }`}
                    >
                      <img src={user.avatar} alt="" className="h-5 w-5 rounded-full object-cover" />
                      {user.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="relative z-10 flex min-h-[230px] flex-col items-center justify-center text-center">
              <div className="grid h-16 w-16 place-items-center rounded-3xl bg-white text-3xl shadow-lg dark:bg-slate-900">🎂</div>
              <h3 className="mt-4 text-lg font-black text-slate-900 dark:text-white">还没有可展示的生日资料</h3>
              <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500 dark:text-slate-400">
                同学在个人资料中填写生日后，这里会自动显示今天或最近一位寿星。
              </p>
            </div>
          )}
        </section>

        <aside className="h-fit rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-white">
                <Calendar className="h-4 w-4 text-indigo-500" />
                未来七天
              </h3>
              <p className="mt-0.5 text-[10px] text-slate-400">仅显示一周内即将到来的生日</p>
            </div>
            <span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
              {upcomingWeek.length} 人
            </span>
          </div>

          {upcomingWeek.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center dark:border-slate-700 dark:bg-slate-800/50">
              <Clock className="mx-auto h-5 w-5 text-slate-300" />
              <p className="mt-2 text-[11px] leading-5 text-slate-400">未来七天暂无生日<br />可以先为最近的寿星补上祝福</p>
            </div>
          ) : (
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1 scrollbar-none">
              {upcomingWeek.map((user) => (
                <button
                  type="button"
                  key={user.uid}
                  onClick={() => openComposerFor(user)}
                  className="group flex w-full items-center gap-2.5 rounded-2xl border border-slate-100 bg-slate-50/80 p-2.5 text-left transition hover:border-indigo-200 hover:bg-indigo-50/70 dark:border-slate-800 dark:bg-slate-800/50 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/30"
                >
                  <img src={user.avatar} alt={user.name} className="h-9 w-9 rounded-xl bg-white object-cover shadow-sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">{user.name}</p>
                    <p className="mt-0.5 text-[10px] text-slate-400">{user.birthdayInfo.dateFormatted}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-black text-indigo-600 dark:text-indigo-300">{user.birthdayInfo.daysUntil} 天后</p>
                    <ArrowRight className="ml-auto mt-0.5 h-3 w-3 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div ref={composerRef} className="rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5 lg:sticky lg:top-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-1.5 text-sm font-black text-slate-900 dark:text-white">
                <Gift className="h-4 w-4 text-rose-500" />
                写下生日祝福
              </h3>
              <p className="mt-1 text-[11px] text-slate-400">送出后仍可由你本人修改</p>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-2xl bg-rose-50 text-lg dark:bg-rose-950/40">💌</div>
          </div>

          <form onSubmit={handleSendWish} className="space-y-3.5">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold text-slate-600 dark:text-slate-300">送给谁</label>
              <select
                value={selectedUid}
                onChange={(event) => {
                  setSelectedUid(event.target.value);
                  setActionError('');
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none transition focus:border-rose-300 focus:ring-2 focus:ring-rose-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-rose-950"
              >
                {users.length === 0 && <option value="">暂无同学资料</option>}
                {users.map((user) => (
                  <option key={user.uid} value={user.uid}>
                    {user.name}{user.birthday ? ` · ${getBirthdayInfo(user.birthday, todayKey)?.dateFormatted || ''}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative" ref={templateRef}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">祝福内容</label>
                <button
                  type="button"
                  onClick={() => setShowTemplateDropdown((current) => !current)}
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                >
                  快捷模板
                  <ChevronDown className={`h-3 w-3 transition ${showTemplateDropdown ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {showTemplateDropdown && (
                <div className="absolute left-0 right-0 top-7 z-30 max-h-56 space-y-1 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                  {WISH_TEMPLATES.map((template) => (
                    <button
                      key={template}
                      type="button"
                      onClick={() => {
                        setCustomMsg(template);
                        setShowTemplateDropdown(false);
                      }}
                      className="w-full rounded-xl p-2.5 text-left text-[11px] leading-5 text-slate-600 transition hover:bg-rose-50 hover:text-rose-700 dark:text-slate-300 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
                    >
                      {template}
                    </button>
                  ))}
                </div>
              )}

              <textarea
                required
                rows={5}
                maxLength={300}
                placeholder="写下你最真挚的祝福……"
                value={customMsg}
                onChange={(event) => {
                  setCustomMsg(event.target.value);
                  setActionError('');
                }}
                className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs leading-5 text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-rose-950"
              />
              <span className="absolute bottom-2 right-2 text-[9px] text-slate-300">{customMsg.length}/300</span>
            </div>

            {actionError && (
              <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-[11px] text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
                {actionError}
              </p>
            )}

            <button
              type="submit"
              disabled={sending || !profile || !selectedUser || !customMsg.trim()}
              className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 via-fuchsia-500 to-violet-500 px-4 py-3 text-xs font-black text-white shadow-lg shadow-rose-200 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 dark:shadow-none"
            >
              {sending ? <Sparkles className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />}
              {sending ? '正在送出祝福…' : '送出祝福，点亮庆生礼花'}
            </button>
          </form>
        </div>

        <section className="min-w-0 rounded-[24px] border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/30 sm:p-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="flex items-center gap-1.5 text-sm font-black text-slate-900 dark:text-white">
                <MessageCircle className="h-4 w-4 text-indigo-500" />
                {featuredUser ? `${featuredUser.name} 的祝福墙` : '生日祝福墙'}
              </h3>
              <p className="mt-1 text-[11px] text-slate-400">
                {isBirthdayToday ? '今天的寿星会自动成为祝福墙主角' : '今天无人生日，展示最近一位寿星收到的祝福'}
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <Users className="h-3 w-3" />
              {featuredWishes.length} 份心意 · 实时同步
            </span>
          </div>

          {featuredWishes.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-900">
              <div className="grid h-14 w-14 place-items-center rounded-3xl bg-gradient-to-br from-rose-100 to-amber-100 text-2xl dark:from-rose-950 dark:to-amber-950">💌</div>
              <p className="mt-3 text-sm font-black text-slate-800 dark:text-slate-100">
                {featuredUser ? `还没有送给 ${featuredUser.name} 的祝福` : '还没有可展示的祝福'}
              </p>
              <p className="mt-1 max-w-sm text-[11px] leading-5 text-slate-400">第一份真诚的心意，往往最让人难忘。</p>
              {featuredUser && (
                <button
                  type="button"
                  onClick={() => openComposerFor(featuredUser)}
                  className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-600 transition hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300"
                >
                  写第一份祝福
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {featuredWishes.map((wish) => {
                const hasLiked = profile ? wish.likes?.includes(profile.uid) : false;
                const likesCount = wish.likes?.length || 0;
                const isEditing = editingWishId === wish.id;
                const canEdit = wish.senderUid === profile?.uid;
                const canDelete = isCommittee || canEdit;

                return (
                  <article
                    key={wish.id}
                    className="flex min-h-48 flex-col rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-rose-900"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <img
                          src={wish.senderAvatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=student'}
                          alt={wish.senderName}
                          className="h-9 w-9 shrink-0 rounded-2xl border border-slate-100 bg-slate-50 object-cover dark:border-slate-700"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-black text-slate-900 dark:text-white">{wish.senderName}</p>
                          <p className="mt-0.5 text-[10px] text-slate-400">
                            {formatWishTime(wish.createdAt)}{wish.updatedAt ? ' · 已编辑' : ''}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
                        TO {wish.targetName}
                      </span>
                    </div>

                    {isEditing ? (
                      <div className="mt-3 flex flex-1 flex-col">
                        <textarea
                          autoFocus
                          rows={5}
                          maxLength={300}
                          value={editMessage}
                          onChange={(event) => setEditMessage(event.target.value)}
                          className="w-full flex-1 resize-none rounded-2xl border border-rose-200 bg-rose-50/40 p-3 text-xs leading-5 text-slate-700 outline-none focus:ring-2 focus:ring-rose-100 dark:border-rose-900 dark:bg-rose-950/20 dark:text-slate-200 dark:focus:ring-rose-950"
                        />
                        <div className="mt-2 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingWishId(null);
                              setEditMessage('');
                            }}
                            disabled={savingEdit}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <X className="h-3 w-3" />取消
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(wish)}
                            disabled={savingEdit || !editMessage.trim()}
                            className="inline-flex items-center gap-1 rounded-lg bg-rose-500 px-2.5 py-1.5 text-[10px] font-bold text-white disabled:opacity-50"
                          >
                            <Check className="h-3 w-3" />{savingEdit ? '保存中' : '保存修改'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-3 flex-1 whitespace-pre-wrap rounded-2xl bg-gradient-to-br from-slate-50 to-rose-50/60 p-3 text-xs leading-6 text-slate-700 dark:from-slate-800/80 dark:to-rose-950/20 dark:text-slate-200">
                        {wish.message}
                      </p>
                    )}

                    {!isEditing && (
                      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-slate-800">
                        <div className="flex items-center gap-1">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => startEditingWish(wish)}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
                            >
                              <Pencil className="h-3 w-3" />编辑
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setWishToDelete(wish)}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
                            >
                              <Trash2 className="h-3 w-3" />删除
                            </button>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => profile && toggleLikeWish(wish.id, profile.uid, !!hasLiked)}
                          disabled={!profile}
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                            hasLiked
                              ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300'
                              : 'text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/30'
                          }`}
                        >
                          <Heart className={`h-3.5 w-3.5 ${hasLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
                          {likesCount > 0 ? likesCount : '点赞'}
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <ConfirmModal
        isOpen={Boolean(wishToDelete)}
        title="确认删除该条生日祝福？"
        message={`确定要删除 ${wishToDelete?.senderName} 送给 @${wishToDelete?.targetName} 的祝福吗？`}
        confirmText="确认删除"
        onConfirm={async () => {
          if (wishToDelete) {
            await deleteBirthdayWish(wishToDelete.id);
            if (editingWishId === wishToDelete.id) setEditingWishId(null);
          }
        }}
        onClose={() => setWishToDelete(null)}
      />

      {showCelebration && (
        <div className="birthday-celebration-overlay pointer-events-none fixed inset-0 z-[100] overflow-hidden" role="status" aria-live="polite">
          <div className="birthday-celebration-glow absolute inset-0" />
          {CELEBRATION_PARTICLES.map((particle, index) => (
            <span
              key={`${particle.emoji}-${index}`}
              className="birthday-float-particle absolute text-2xl sm:text-3xl"
              style={{
                left: `${particle.left}%`,
                animationDelay: `${particle.delay}s`,
                animationDuration: `${particle.duration}s`
              }}
            >
              {particle.emoji}
            </span>
          ))}
          <div className="birthday-celebration-card absolute left-1/2 top-1/2 w-[min(88vw,420px)] rounded-[32px] border border-white/70 bg-white/90 p-6 text-center shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/90 sm:p-8">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-[28px] bg-gradient-to-br from-rose-100 via-fuchsia-100 to-amber-100 text-5xl shadow-inner dark:from-rose-950 dark:via-fuchsia-950 dark:to-amber-950">
              🎂
            </div>
            <p className="mt-4 text-[11px] font-black uppercase tracking-[0.22em] text-rose-500">A special wish for</p>
            <p className="mt-1 truncate text-2xl font-black text-slate-950 dark:text-white sm:text-3xl">{celebrationName}</p>
            <p className="mt-2 bg-gradient-to-r from-rose-500 via-fuchsia-500 to-violet-500 bg-clip-text text-sm font-bold text-transparent">
              生日快乐 · 愿所有美好如约而至
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
