import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, KeyRound, ShieldCheck, UserPlus, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthMode = 'login' | 'register';
type SubmittingAction = 'member' | 'admin' | 'register' | null;

const readableAuthError = (error: unknown): string => {
  const code = (error as { code?: string })?.code;
  if (code === 'auth/invalid-credential') return '学号或密码错误';
  if (code === 'auth/operation-not-allowed') return '成员学号登录尚未启用，请联系管理员开启“电子邮件地址/密码”登录方式';
  if (code === 'auth/unauthorized-domain') return '当前网站域名未获 Firebase 授权，请联系管理员将其添加到“已获授权的网域”后重试';
  if (code === 'auth/email-already-in-use') return '该学号已注册。如已提交申请，请等待管理员审批；如已批准，请直接登录。';
  if (code === 'auth/weak-password') return '密码强度不足，请使用至少 8 位密码';
  if (code === 'auth/too-many-requests') return '尝试次数过多，请稍后再试';
  if (code === 'auth/popup-closed-by-user') return '已取消 Google 登录';
  if (code === 'auth/popup-blocked') return '浏览器拦截了登录窗口，请允许弹窗后重试';
  if (code === 'auth/network-request-failed') return '网络连接失败，请检查网络后重试';
  return error instanceof Error ? error.message : '操作失败，请稍后重试';
};

const fieldClassName = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 caret-indigo-600 placeholder:text-slate-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:caret-indigo-400 dark:placeholder:text-slate-500';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { loginWithGoogle, loginWithStudentIdOrEmail, registerMember } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [studentId, setStudentId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState<SubmittingAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [registrationComplete, setRegistrationComplete] = useState(false);

  if (!isOpen) return null;

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError(null);
    setRegistrationComplete(false);
  };

  const handleMemberLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting('member');
    try {
      await loginWithStudentIdOrEmail(studentId, password);
      onClose();
    } catch (loginError) {
      setError(readableAuthError(loginError));
    } finally {
      setSubmitting(null);
    }
  };

  const handleRegistration = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setSubmitting('register');
    try {
      await registerMember({ studentId, name, email, password });
      setRegistrationComplete(true);
      setPassword('');
      setConfirmPassword('');
    } catch (registrationError) {
      setError(readableAuthError(registrationError));
    } finally {
      setSubmitting(null);
    }
  };

  const handleAdminLogin = async () => {
    setError(null);
    setSubmitting('admin');
    try {
      await loginWithGoogle();
      onClose();
    } catch (loginError) {
      setError(readableAuthError(loginError));
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
      <div className="my-auto w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <ShieldCheck className="h-5 w-5" />
              <span className="text-xs font-black tracking-widest">身份验证</span>
            </div>
            <h2 className="mt-2 text-xl font-black text-slate-900 dark:text-white">
              {mode === 'login' ? '进入私人班级空间' : '申请加入班级'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label="关闭身份验证窗口"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="tablist" aria-label="登录或注册">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => switchMode('login')}
              className={`rounded-lg px-3 py-2 text-xs font-bold transition ${mode === 'login' ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-700 dark:text-indigo-300' : 'text-slate-500 dark:text-slate-400'}`}
            >
              成员登录
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              onClick={() => switchMode('register')}
              className={`rounded-lg px-3 py-2 text-xs font-bold transition ${mode === 'register' ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-700 dark:text-indigo-300' : 'text-slate-500 dark:text-slate-400'}`}
            >
              新同学注册
            </button>
          </div>

          {error && (
            <div role="alert" className="mb-4 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'register' && registrationComplete ? (
            <div className="space-y-5 py-3 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">注册申请已提交</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  管理员会核对你的姓名和学号。批准后，使用刚才的学号和密码登录即可进入。
                </p>
              </div>
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-500"
              >
                返回登录
              </button>
            </div>
          ) : mode === 'register' ? (
            <form onSubmit={handleRegistration} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="register-student-id" className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">学号</label>
                  <input id="register-student-id" value={studentId} onChange={(event) => setStudentId(event.target.value)} autoComplete="username" required minLength={2} maxLength={32} placeholder="输入本人学号" className={fieldClassName} />
                </div>
                <div>
                  <label htmlFor="register-name" className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">真实姓名</label>
                  <input id="register-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required maxLength={40} placeholder="便于管理员核对" className={fieldClassName} />
                </div>
              </div>
              <div>
                <label htmlFor="register-email" className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">联系邮箱（可选）</label>
                <input id="register-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" maxLength={120} placeholder="仅供管理员核对" className={fieldClassName} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="register-password" className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">设置密码</label>
                  <input id="register-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required minLength={8} placeholder="至少 8 位" className={fieldClassName} />
                </div>
                <div>
                  <label htmlFor="register-confirm-password" className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">确认密码</label>
                  <input id="register-confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" required minLength={8} placeholder="再输入一次" className={fieldClassName} />
                </div>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                提交后仍不能查看班级内容。只有管理员批准后，账号才会获得访问权限。
              </div>
              <button type="submit" disabled={submitting !== null} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60">
                <UserPlus className="h-4 w-4" />
                {submitting === 'register' ? '正在提交申请...' : '提交注册申请'}
              </button>
            </form>
          ) : (
            <div className="space-y-5">
              <form onSubmit={handleMemberLogin} className="space-y-3">
                <div>
                  <label htmlFor="login-student-id" className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">成员学号</label>
                  <input id="login-student-id" value={studentId} onChange={(event) => setStudentId(event.target.value)} autoComplete="username" required placeholder="输入学号" className={fieldClassName} />
                </div>
                <div>
                  <label htmlFor="login-password" className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">密码</label>
                  <input id="login-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required placeholder="输入密码" className={fieldClassName} />
                </div>
                <button type="submit" disabled={submitting !== null} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60">
                  <KeyRound className="h-4 w-4" />
                  {submitting === 'member' ? '正在验证...' : '成员登录'}
                </button>
              </form>

              <div className="flex items-center gap-3 text-[11px] font-bold text-slate-400">
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                管理员专用
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
              </div>

              <button type="button" onClick={handleAdminLogin} disabled={submitting !== null} className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm font-black text-blue-600">G</span>
                {submitting === 'admin' ? '正在验证管理员身份...' : '使用管理员 Google 账号登录'}
              </button>

              <p className="text-center text-xs leading-5 text-slate-500 dark:text-slate-400">
                还没有账号？切换到“新同学注册”提交申请，批准前不会显示班级数据。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
