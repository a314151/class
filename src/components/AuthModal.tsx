import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  LogIn, 
  UserPlus, 
  Mail, 
  Lock, 
  User, 
  Hash, 
  Sparkles, 
  CheckCircle2, 
  X,
  KeyRound,
  ArrowLeft,
  Send,
  AlertCircle,
  HelpCircle
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register' | 'profile' | 'forgot_password';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login'
}) => {
  const { 
    currentUser, 
    profile, 
    loginWithGoogle, 
    loginWithStudentIdOrEmail,
    registerStudent,
    sendPasswordReset,
    updateMyProfile 
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'register' | 'profile' | 'forgot_password'>(initialMode);
  
  // Login & Register & Reset inputs
  const [accountInput, setAccountInput] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [email, setEmail] = useState('');
  
  // Forgot password states
  const [resetAccount, setResetAccount] = useState('');
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);

  // Profile edit states
  const [editName, setEditName] = useState(profile?.name || '');
  const [editStudentId, setEditStudentId] = useState(profile?.studentId || '');
  const [editBirthday, setEditBirthday] = useState(profile?.birthday || '2008-06-15');
  const [editPhone, setEditPhone] = useState(profile?.phone || '');
  const [editBio, setEditBio] = useState(profile?.bio || '');
  const [editAvatar, setEditAvatar] = useState(profile?.avatar || '');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await loginWithGoogle();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Google 登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!accountInput.trim() || !password) {
      setError('请填入学号（或邮箱）以及对应密码');
      return;
    }
    setLoading(true);
    try {
      await loginWithStudentIdOrEmail(accountInput.trim(), password);
      onClose();
    } catch (err: any) {
      setError(err.message || '登录失败，请检查学号与密码');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!studentId.trim() || !name.trim() || !email.trim() || !password) {
      setError('请完整填入学号、姓名、邮箱和密码');
      return;
    }
    if (password.length < 6) {
      setError('为保障账号安全，密码长度至少需要 6 位字符');
      return;
    }
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致，请核对');
      return;
    }
    setLoading(true);
    try {
      await registerStudent(studentId.trim(), name.trim(), email.trim(), password);
      onClose();
    } catch (err: any) {
      setError(err.message || '注册失败，请检查信息');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResetSuccessMessage(null);
    if (!resetAccount.trim()) {
      setError('请输入您注册时的学号或绑定邮箱');
      return;
    }
    setLoading(true);
    try {
      const result = await sendPasswordReset(resetAccount.trim());
      setResetSuccessMessage(`密码重置邮件已成功发送至注册邮箱：${result.email}。请查收邮件并根据邮件内链接重置密码。`);
    } catch (err: any) {
      setError(err.message || '发送密码重置邮件失败，请核对学号或邮箱');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateMyProfile({
        name: editName.trim(),
        studentId: editStudentId.trim(),
        birthday: editBirthday,
        phone: editPhone.trim(),
        bio: editBio.trim(),
        avatar: editAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${editName}`
      });
      onClose();
    } catch (err: any) {
      setError(err.message || '保存个人信息失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-md">
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/60 dark:border-white/15 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 relative animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 font-bold"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center space-y-1">
          <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto text-indigo-600 dark:text-indigo-400 border border-indigo-400/30 shadow-inner">
            {mode === 'profile' ? (
              <User className="w-6 h-6" />
            ) : mode === 'forgot_password' ? (
              <KeyRound className="w-6 h-6" />
            ) : mode === 'register' ? (
              <UserPlus className="w-6 h-6" />
            ) : (
              <LogIn className="w-6 h-6" />
            )}
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            {mode === 'profile' && '个人信息维护'}
            {mode === 'login' && '登录班级空间'}
            {mode === 'register' && '首次注册 · 绑定学号与密码'}
            {mode === 'forgot_password' && '找回与重置密码'}
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
            {mode === 'profile' && '完善你的学号与生日，解锁完整班级功能'}
            {mode === 'login' && '支持直接输入「学号」或「绑定邮箱」及密码登录'}
            {mode === 'register' && '每个学号绑定初始密码与通知邮箱，仅需注册一次'}
            {mode === 'forgot_password' && '输入学号或邮箱，通过绑定的安全邮箱重置密码'}
          </p>
        </div>

        {/* Top tabs for Login vs Register */}
        {(mode === 'login' || mode === 'register') && (
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200/60 dark:border-slate-700">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
                mode === 'login'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              学号 / 邮箱密码登录
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(null); }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
                mode === 'register'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              新同学注册学号
            </button>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-500/20 border border-rose-400/40 rounded-2xl text-xs text-rose-900 dark:text-rose-200 font-semibold flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. LOGIN MODE */}
        {mode === 'login' && (
          <div className="space-y-4">
            <form onSubmit={handleLoginSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  学号 或 注册邮箱 *
                </label>
                <div className="relative">
                  <Hash className="w-3.5 h-3.5 absolute left-3 top-3 text-indigo-500" />
                  <input
                    type="text"
                    required
                    placeholder="输入学号 (如 20260002) 或 邮箱"
                    value={accountInput}
                    onChange={(e) => setAccountInput(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
                  />
                </div>
                <div className="flex items-center gap-1 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <HelpCircle className="w-3 h-3 text-indigo-500 shrink-0" />
                  <span>可以直接输入您的学号（例：<strong className="text-indigo-600 dark:text-indigo-400">20260002</strong>）</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    账号密码 *
                  </label>
                  <button
                    type="button"
                    onClick={() => { setMode('forgot_password'); setError(null); setResetSuccessMessage(null); }}
                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    忘记密码？点此找回
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="password"
                    required
                    placeholder="输入注册时设置的密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-2xl shadow-lg shadow-indigo-600/30 border border-white/20 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                {loading ? '正在验证学号与密码...' : '立即登录班级空间'}
              </button>
            </form>

            <div className="relative flex items-center justify-center pt-1">
              <div className="border-t border-white/40 dark:border-white/10 w-full" />
              <span className="bg-transparent px-3 text-[11px] font-medium text-slate-500 uppercase">
                或使用其他方式
              </span>
            </div>

            {/* Google Sign-in button */}
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-2xl border border-white/60 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              使用 Google 账号一键快捷登录
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => { setMode('register'); setError(null); }}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                还没有注册学号？点此注册加入班级
              </button>
            </div>
          </div>
        )}

        {/* 2. REGISTER MODE */}
        {mode === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  真实姓名 *
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="姓名 (如: 张晓明)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200/70 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  学号 *
                </label>
                <div className="relative">
                  <Hash className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="学号 (如: 20260002)"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200/70 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                找回与通知邮箱 *
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="常用邮箱 (用于接收重置密码邮件)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200/70 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  初始密码 *
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="password"
                    required
                    placeholder="至少 6 位"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200/70 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  确认密码 *
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="password"
                    required
                    placeholder="再次输入"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200/70 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/50 dark:border-slate-700">
              📌 <strong>绑定说明</strong>：每个学号首次注册时与此密码及邮箱绑定，后续所有登录均以此密码为准。
            </p>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-2xl shadow-lg shadow-indigo-600/30 border border-white/20 transition-all active:scale-95"
            >
              {loading ? '正在创建账号...' : '确认注册并绑定密码'}
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => { setMode('login'); setError(null); }}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                已有账号？点此返回学号登录
              </button>
            </div>
          </form>
        )}

        {/* 3. FORGOT PASSWORD MODE */}
        {mode === 'forgot_password' && (
          <div className="space-y-4">
            {resetSuccessMessage ? (
              <div className="p-4 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl space-y-3 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="text-xs text-emerald-900 dark:text-emerald-200 font-semibold leading-relaxed">
                  {resetSuccessMessage}
                </p>
                <button
                  type="button"
                  onClick={() => { setMode('login'); setResetSuccessMessage(null); setError(null); }}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-md active:scale-95"
                >
                  返回登录
                </button>
              </div>
            ) : (
              <form onSubmit={handleResetPasswordSubmit} className="space-y-3">
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  请输入您注册时填写的<strong>学号</strong>（或绑定邮箱），系统将自动向对应邮箱发送密码重置安全邮件：
                </p>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    学号 或 注册邮箱 *
                  </label>
                  <div className="relative">
                    <Hash className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="输入您的学号 (如 20260002) 或邮箱"
                      value={resetAccount}
                      onChange={(e) => setResetAccount(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200/70 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 text-slate-900 dark:text-slate-100 font-medium"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-2xl shadow-lg shadow-indigo-600/30 border border-white/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  {loading ? '正在发送重置邮件...' : '发送密码重置邮件'}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setError(null); }}
                    className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    记起密码？返回登录
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* 4. PROFILE EDIT MODE */}
        {mode === 'profile' && (
          <form onSubmit={handleSaveProfile} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                真实姓名 *
              </label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="你的姓名"
                className="w-full px-3.5 py-2 text-xs rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 backdrop-blur-md text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  学号
                </label>
                <input
                  type="text"
                  value={editStudentId}
                  onChange={(e) => setEditStudentId(e.target.value)}
                  placeholder="20260101"
                  className="w-full px-3.5 py-2 text-xs rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 backdrop-blur-md text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  公历生日 (生日墙)
                </label>
                <input
                  type="date"
                  value={editBirthday}
                  onChange={(e) => setEditBirthday(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 backdrop-blur-md text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                个性寄语 / 班级宣言
              </label>
              <input
                type="text"
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                placeholder="例如：热爱班集体，奋斗向前"
                className="w-full px-3.5 py-2 text-xs rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 backdrop-blur-md text-slate-900 dark:text-slate-100"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-2xl shadow-lg shadow-indigo-600/30 border border-white/20 transition-all mt-2 active:scale-95"
            >
              {loading ? '保存中...' : '保存修改'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
