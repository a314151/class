import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  LogIn, 
  UserPlus, 
  Mail, 
  Lock, 
  User, 
  Hash, 
  Calendar, 
  Sparkles, 
  CheckCircle2, 
  X,
  Phone,
  BookOpen
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register' | 'profile';
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
    loginWithEmail, 
    registerWithEmail, 
    updateMyProfile 
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'register' | 'profile'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  
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

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
      } else {
        if (!name.trim() || !studentId.trim()) {
          throw new Error('请填写姓名与学号');
        }
        await registerWithEmail(email, password, name.trim(), studentId.trim());
      }
      onClose();
    } catch (err: any) {
      setError(err.message || '操作失败，请检查账号密码');
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
      <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-white/60 dark:border-white/15 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-5 relative animate-in fade-in zoom-in-95">
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
            {mode === 'profile' ? <User className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            {mode === 'profile' ? '个人信息维护' : mode === 'login' ? '登录班级空间' : '加入班级空间'}
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
            {mode === 'profile' ? '完善你的学号与生日，解锁完整班级功能' : '连接 Firebase Auth 安全认证与实时 Firestore'}
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/20 border border-rose-400/40 rounded-2xl text-xs text-rose-900 dark:text-rose-200 font-semibold">
            {error}
          </div>
        )}

        {/* PROFILE EDIT MODE */}
        {mode === 'profile' ? (
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
                className="w-full px-3.5 py-2.5 text-xs rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 backdrop-blur-md text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  学号 *
                </label>
                <input
                  type="text"
                  required
                  value={editStudentId}
                  onChange={(e) => setEditStudentId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 backdrop-blur-md text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  生日 (用于生日墙)
                </label>
                <input
                  type="date"
                  value={editBirthday}
                  onChange={(e) => setEditBirthday(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 backdrop-blur-md text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                个性签名 / 寄语
              </label>
              <input
                type="text"
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                placeholder="例如：热爱班级，共同奋斗"
                className="w-full px-3.5 py-2.5 text-xs rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 backdrop-blur-md text-slate-900 dark:text-slate-100"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-2xl shadow-lg shadow-indigo-600/30 border border-white/20 transition-all mt-2 active:scale-95"
            >
              {loading ? '保存中...' : '保存资料'}
            </button>
          </form>
        ) : (
          /* LOGIN & REGISTER MODES */
          <div className="space-y-4">
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

            <div className="relative flex items-center justify-center">
              <div className="border-t border-white/40 dark:border-white/10 w-full" />
              <span className="bg-transparent px-3 text-[11px] font-medium text-slate-500 uppercase">
                或使用邮箱登录
              </span>
            </div>

            {/* Email form */}
            <form onSubmit={handleEmailSubmit} className="space-y-3">
              {mode === 'register' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      姓名 *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="你的姓名"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200/70 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      学号 *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="例：20260101"
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200/70 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  邮箱账号
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="student@school.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200/70 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  密码
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200/70 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-2xl shadow-lg shadow-indigo-600/30 border border-white/20 transition-all active:scale-95"
              >
                {loading ? '处理中...' : mode === 'login' ? '立即登录' : '注册并进入班级'}
              </button>
            </form>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {mode === 'login' ? '还没有账号？点此注册加入班级' : '已有账号？点此返回登录'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
