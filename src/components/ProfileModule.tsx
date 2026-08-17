import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  User, 
  Sparkles, 
  Cake, 
  Hash, 
  Phone, 
  FileText, 
  Key, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Camera, 
  Crown,
  X
} from 'lucide-react';

const PRESET_AVATARS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=Felix',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Luna',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Leo',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Milo',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Zoe',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Alex',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Oliver',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Sophie'
];

export const ProfileModule: React.FC = () => {
  const { profile, isSuperAdmin, isCommittee, updateMyProfile, claimSuperAdmin } = useAuth();

  const [name, setName] = useState(profile?.name || '');
  const [studentId, setStudentId] = useState(profile?.studentId || '');
  const [birthday, setBirthday] = useState(profile?.birthday || '2008-06-15');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [avatar, setAvatar] = useState(profile?.avatar || PRESET_AVATARS[0]);

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  // Minimal Modal for Super Admin Secret Command Input
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminCommand, setAdminCommand] = useState('');
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminSuccess, setAdminSuccess] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setStudentId(profile.studentId || '');
      setBirthday(profile.birthday || '2008-06-15');
      setPhone(profile.phone || '');
      setBio(profile.bio || '');
      setAvatar(profile.avatar || PRESET_AVATARS[0]);
    }
  }, [profile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('请填写姓名');
      return;
    }
    setSaving(true);
    try {
      await updateMyProfile({
        name: name.trim(),
        studentId: studentId.trim(),
        birthday,
        phone: phone.trim(),
        bio: bio.trim(),
        avatar: avatar.trim() || `https://api.dicebear.com/7.x/bottts/svg?seed=${name.trim()}`
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save profile:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleRandomAvatar = () => {
    const randomSeed = Math.random().toString(36).substring(2, 9);
    setAvatar(`https://api.dicebear.com/7.x/bottts/svg?seed=${randomSeed}`);
  };

  const handleClaimAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError(null);
    setAdminSuccess(false);

    const cmd = adminCommand.trim();
    if (!cmd) {
      setAdminError('请输入指令');
      return;
    }

    try {
      const success = await claimSuperAdmin(cmd);
      if (success) {
        setAdminSuccess(true);
        setAdminCommand('');
        setTimeout(() => {
          setShowAdminModal(false);
          setAdminSuccess(false);
        }, 800);
      } else {
        setAdminError('指令不正确，请重新输入');
      }
    } catch (err) {
      console.error('Submit command error:', err);
      setAdminError('认证出错，请重试');
    }
  };

  // Birthday calculation
  const getBirthdayCountdown = (bdayStr?: string) => {
    if (!bdayStr) return null;
    const today = new Date();
    const [_, month, day] = bdayStr.split('-').map(Number);
    if (!month || !day) return null;

    let targetDate = new Date(today.getFullYear(), month - 1, day);
    if (targetDate.getTime() < today.setHours(0, 0, 0, 0)) {
      targetDate = new Date(today.getFullYear() + 1, month - 1, day);
    }

    const diffMs = targetDate.getTime() - new Date().setHours(0, 0, 0, 0);
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysUntilBirthday = getBirthdayCountdown(birthday);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white/40 dark:bg-slate-900/50 backdrop-blur-xl p-5 rounded-3xl border border-white/50 dark:border-white/10 shadow-xl shadow-indigo-950/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 drop-shadow-xs">
            <User className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            个人中心 · 资料设置
          </h2>
          <p className="text-xs text-slate-700/80 dark:text-slate-300/80 mt-1 font-medium">
            维护您的班级姓名、专属头像、学号与生日档案，信息将在班级空间各模块中展现
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-2xl text-xs font-bold border backdrop-blur-md shadow-xs ${
            isSuperAdmin
              ? 'bg-rose-500/20 text-rose-950 dark:text-rose-200 border-rose-400/40'
              : isCommittee
                ? 'bg-amber-500/20 text-amber-950 dark:text-amber-200 border-amber-400/40'
                : 'bg-indigo-500/20 text-indigo-950 dark:text-indigo-200 border-indigo-400/40'
          }`}>
            {isSuperAdmin ? '👑 超级管理员' : isCommittee ? '⭐ 班委' : '👤 普通成员'}
          </span>

          {/* Clean minimal button for Super Admin Command */}
          {!isSuperAdmin && (
            <button
              type="button"
              onClick={() => {
                setShowAdminModal(true);
                setAdminError(null);
                setAdminSuccess(false);
              }}
              className="p-1.5 rounded-2xl bg-white/40 hover:bg-white/70 dark:bg-white/10 dark:hover:bg-white/20 border border-white/50 dark:border-white/15 text-slate-600 hover:text-slate-900 dark:text-slate-300 transition-all shadow-xs"
              title="口令认证"
            >
              <Key className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Avatar & Profile Card Preview */}
        <div className="lg:col-span-1 space-y-6">
          <div className="p-6 bg-white/40 dark:bg-slate-900/50 backdrop-blur-xl rounded-3xl border border-white/50 dark:border-white/10 shadow-xl shadow-indigo-950/5 text-center space-y-4">
            <div className="relative inline-block mx-auto">
              <img
                src={avatar}
                alt={name || '用户头像'}
                className="w-24 h-24 rounded-full mx-auto bg-white/80 dark:bg-slate-800/80 border-4 border-white/80 dark:border-white/20 shadow-xl object-cover"
              />
              <button
                type="button"
                onClick={handleRandomAvatar}
                title="随机切换头像"
                className="absolute bottom-0 right-0 p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-md border-2 border-white dark:border-slate-900 transition-transform active:scale-90"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {name || '未设置姓名'}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-mono mt-0.5">
                学号：{studentId || '未绑定学号'}
              </p>
            </div>

            {/* Bio Card */}
            <div className="p-3.5 rounded-2xl bg-white/50 dark:bg-white/5 border border-white/60 dark:border-white/10 text-left">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                个性签名 / 寄语
              </span>
              <p className="text-xs text-slate-800 dark:text-slate-200 italic leading-relaxed">
                "{bio || '热爱班集体，与同学共同进步！'}"
              </p>
            </div>

            {/* Birthday Reminder Box */}
            <div className="p-3.5 rounded-2xl bg-linear-to-r from-pink-500/10 to-purple-500/10 border border-pink-400/20 text-left flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cake className="w-4 h-4 text-pink-500" />
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    {birthday ? `${birthday.split('-')[1]}月${birthday.split('-')[2]}日` : '未设置生日'}
                  </span>
                  <span className="text-[10px] text-slate-600 dark:text-slate-400">已同步至生日墙</span>
                </div>
              </div>
              {daysUntilBirthday !== null && (
                <span className="text-[11px] font-bold text-pink-700 dark:text-pink-300 bg-pink-500/20 px-2.5 py-1 rounded-xl border border-pink-400/30">
                  {daysUntilBirthday === 0 ? '🎉 今天生日！' : `还有 ${daysUntilBirthday} 天`}
                </span>
              )}
            </div>

            {/* Preset Avatars Bar */}
            <div className="text-left space-y-2 pt-2 border-t border-white/40 dark:border-white/10">
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                推荐预设头像
              </label>
              <div className="grid grid-cols-4 gap-2">
                {PRESET_AVATARS.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setAvatar(url)}
                    className={`p-1 rounded-xl border transition-all ${
                      avatar === url 
                        ? 'border-indigo-600 bg-indigo-500/20 ring-2 ring-indigo-500/30' 
                        : 'border-white/50 dark:border-white/10 hover:border-indigo-300 bg-white/40 dark:bg-white/5'
                    }`}
                  >
                    <img src={url} alt={`Avatar ${idx}`} className="w-8 h-8 rounded-lg mx-auto" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Profile Edit Form */}
        <div className="lg:col-span-2">
          <div className="p-6 bg-white/40 dark:bg-slate-900/50 backdrop-blur-xl rounded-3xl border border-white/50 dark:border-white/10 shadow-xl shadow-indigo-950/5 space-y-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 pb-3 border-b border-white/40 dark:border-white/10">
              <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              编辑我的基本信息
            </h3>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-500" />
                    真实姓名 / 班级昵称 *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="例如：李明"
                    className="w-full px-3.5 py-2.5 text-xs rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 backdrop-blur-md text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-indigo-500" />
                    学号 / 学生编号 *
                  </label>
                  <input
                    type="text"
                    required
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    placeholder="例如：20260108"
                    className="w-full px-3.5 py-2.5 text-xs rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 backdrop-blur-md text-slate-900 dark:text-slate-100 font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Cake className="w-3.5 h-3.5 text-pink-500" />
                    公历生日 (生日墙庆生用)
                  </label>
                  <input
                    type="date"
                    value={birthday}
                    onChange={(e) => setBirthday(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 backdrop-blur-md text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-500" />
                    联系电话 / 微信 (选填)
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="便于紧急活动班委联络"
                    className="w-full px-3.5 py-2.5 text-xs rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 backdrop-blur-md text-slate-900 dark:text-slate-100 font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-violet-500" />
                  自定义头像图片链接 (URL)
                </label>
                <input
                  type="url"
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                  placeholder="https://example.com/my-photo.jpg"
                  className="w-full px-3.5 py-2.5 text-xs rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 backdrop-blur-md text-slate-900 dark:text-slate-100 font-mono text-[11px] focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  个性签名 / 班级寄语
                </label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="写一句你最喜欢的座右铭，或对班集体的寄语..."
                  className="w-full px-3.5 py-2.5 text-xs rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 backdrop-blur-md text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-between">
                {saveSuccess ? (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4" />
                    个人资料已实时同步更新！
                  </span>
                ) : <div />}

                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-2xl shadow-lg shadow-indigo-600/30 border border-white/20 transition-all active:scale-95 ml-auto"
                >
                  {saving ? '保存中...' : '保存个人资料'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Secret Command Dialog */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-white/30 dark:border-white/10 rounded-3xl p-6 w-full max-w-xs shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-indigo-500" />
                口令认证
              </span>
              <button
                type="button"
                onClick={() => setShowAdminModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleClaimAdminSubmit} className="space-y-3">
              <input
                type="password"
                autoFocus
                placeholder="输入口令指令"
                value={adminCommand}
                onChange={(e) => setAdminCommand(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />

              {adminError && (
                <p className="text-[11px] text-rose-500 font-bold">{adminError}</p>
              )}

              {adminSuccess && (
                <p className="text-[11px] text-emerald-500 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  已进入超级管理员！
                </p>
              )}

              <button
                type="submit"
                className="w-full py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md shadow-indigo-600/30"
              >
                确定
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
