import React, { useState } from 'react';
import { AlertCircle, KeyRound, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const readableAuthError = (error: unknown): string => {
  const code = (error as { code?: string })?.code;
  if (code === 'auth/invalid-credential') return '学号或密码错误';
  if (code === 'auth/popup-closed-by-user') return '已取消 Google 登录';
  if (code === 'auth/popup-blocked') return '浏览器拦截了登录窗口，请允许弹窗后重试';
  if (code === 'auth/network-request-failed') return '网络连接失败，请检查网络后重试';
  return error instanceof Error ? error.message : '登录失败，请稍后重试';
};

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { loginWithGoogle, loginWithStudentIdOrEmail } = useAuth();
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState<'member' | 'admin' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <ShieldCheck className="h-5 w-5" />
              <span className="text-xs font-black tracking-widest">身份验证</span>
            </div>
            <h2 className="mt-2 text-xl font-black text-slate-900 dark:text-white">进入私人班级空间</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label="关闭登录窗口"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-6">
          {error && (
            <div className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleMemberLogin} className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">成员学号</label>
              <input
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
                autoComplete="username"
                required
                placeholder="输入管理员为你开通的学号"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">密码</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                placeholder="输入密码"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <button
              type="submit"
              disabled={submitting !== null}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <KeyRound className="h-4 w-4" />
              {submitting === 'member' ? '正在验证...' : '成员登录'}
            </button>
          </form>

          <div className="flex items-center gap-3 text-[11px] font-bold text-slate-400">
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            管理员专用
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          </div>

          <button
            type="button"
            onClick={handleAdminLogin}
            disabled={submitting !== null}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm font-black text-blue-600">G</span>
            {submitting === 'admin' ? '正在验证管理员身份...' : '使用管理员 Google 账号登录'}
          </button>

          <p className="text-center text-xs leading-5 text-slate-500 dark:text-slate-400">
            不提供公开注册。成员账号只能由管理员创建；普通 Google 账号无法进入。
          </p>
        </div>
      </div>
    </div>
  );
};
