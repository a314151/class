import React, { useState, useEffect } from 'react';
import { 
  UserProfile, 
  ClassSettings, 
  UserRole 
} from '../types';
import { 
  subscribeToUsers, 
  updateUserRole, 
  subscribeToSettings, 
  saveSettings 
} from '../services/firestoreService';
import { useAuth } from '../context/AuthContext';
import { 
  ShieldCheck, 
  Users, 
  Cloud, 
  CheckCircle2, 
  Copy, 
  Sparkles, 
  Edit, 
  Search,
  Lock,
  Key,
  ShieldAlert,
  AlertTriangle,
  Crown
} from 'lucide-react';

const ROLE_NAMES: Record<UserRole, string> = {
  super_admin: '超级管理员 (班长/班主任)',
  committee: '班委会委员 (学委/文娱/团支书)',
  member: '普通班级成员 (同学)'
};

export const SettingsModule: React.FC = () => {
  const { profile, isSuperAdmin, claimSuperAdmin } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchUser, setSearchUser] = useState('');
  const [settings, setSettings] = useState<ClassSettings>({
    className: '高三 (1) 班 · 卓越空间',
    motto: '博学笃行，求是拓新，追光而行',
    semester: '2026年 春季学期',
    announcement: '欢迎进入班级空间！期中模拟考与研学报名正在进行中。',
    cloudflareWorkerUrl: 'https://class-space-worker.pages.dev/api/upload',
    r2BucketName: 'class-space-assets'
  });
  const [copied, setCopied] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Admin authentication input for non-admin view
  const [adminKey, setAdminKey] = useState('');
  const [adminKeyError, setAdminKeyError] = useState<string | null>(null);

  useEffect(() => {
    const unsubUsers = subscribeToUsers((data) => setUsers(data));
    const unsubSettings = subscribeToSettings((data) => setSettings(data));
    return () => {
      unsubUsers();
      unsubSettings();
    };
  }, []);

  const handleRoleChange = async (targetUid: string, newRole: UserRole) => {
    if (!isSuperAdmin) {
      alert('仅超级管理员有权调整同学角色权限');
      return;
    }
    try {
      await updateUserRole(targetUid, newRole);
    } catch (err) {
      console.error('Failed to change role:', err);
    }
  };

  const handleSaveGeneralSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      alert('仅超级管理员可修改班级全局设置');
      return;
    }

    try {
      await saveSettings(settings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  };

  const handleUnlockAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminKeyError(null);
    if (!adminKey.trim()) {
      setAdminKeyError('请输入管理口令');
      return;
    }
    const success = await claimSuperAdmin(adminKey.trim());
    if (!success) {
      setAdminKeyError('授权口令错误，请核实后重试');
    }
  };

  const workerCodeSnippet = `/**
 * Cloudflare Worker 极速处理 R2 文件上传接口
 * 绑定 R2 存储桶变量名: CLASS_BUCKET
 */
export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (request.method === "POST") {
      try {
        const formData = await request.formData();
        const file = formData.get("file");
        if (!file) return new Response("No file", { status: 400 });

        const key = \`\${Date.now()}_\${file.name}\`;
        await env.CLASS_BUCKET.put(key, file.stream(), {
          httpMetadata: { contentType: file.type },
        });

        const publicUrl = \`https://pub-\${env.R2_PUBLIC_DOMAIN}/\${key}\`;
        return new Response(JSON.stringify({ url: publicUrl }), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (err) {
        return new Response(err.message, { status: 500 });
      }
    }
    return new Response("Method not allowed", { status: 405 });
  },
};`;

  const copyWorkerCode = () => {
    navigator.clipboard.writeText(workerCodeSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Filtered users list
  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchUser.toLowerCase()) || 
    (u.studentId && u.studentId.includes(searchUser)) ||
    u.email.toLowerCase().includes(searchUser.toLowerCase())
  );

  // If user is not super admin, show security barrier
  if (!isSuperAdmin) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4 space-y-6">
        <div className="bg-white/40 dark:bg-slate-900/50 backdrop-blur-xl p-8 rounded-3xl border border-white/50 dark:border-white/10 shadow-2xl text-center space-y-4">
          <div className="w-16 h-16 bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-3xl flex items-center justify-center mx-auto border border-rose-400/30">
            <Lock className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              班级管理后台 · 访问受限
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium leading-relaxed">
              班级设置、全班权限分配与系统配置仅超级管理员（班长/班主任）可见并操作。
            </p>
          </div>

          <form onSubmit={handleUnlockAdmin} className="space-y-3 pt-2 text-left">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                请输入超级管理员授权口令解锁：
              </label>
              <div className="relative">
                <Key className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="password"
                  placeholder="输入管理口令"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-xs rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 text-slate-900 dark:text-slate-100"
                />
              </div>
              {adminKeyError && (
                <p className="text-xs text-rose-600 dark:text-rose-400 font-bold mt-1.5 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {adminKeyError}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-lg shadow-indigo-600/30 border border-white/20 transition-all active:scale-95"
            >
              验证口令并进入管理后台
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white/40 dark:bg-slate-900/50 backdrop-blur-xl p-5 rounded-3xl border border-white/50 dark:border-white/10 shadow-xl shadow-indigo-950/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 drop-shadow-xs">
            <Crown className="w-5 h-5 text-amber-500" />
            班级管理后台 · 权限与系统配置
          </h2>
          <p className="text-xs text-slate-700/80 dark:text-slate-300/80 mt-1 font-medium">
            全班三级角色分配（超级管理员、班委、普通成员）、班级基本资料与文件云存储配置
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-500/20 px-3 py-1.5 rounded-2xl border border-rose-400/30">
            👑 超级管理员专属后台
          </span>
        </div>
      </div>

      {/* Section 1: Member Permissions & Roles Table */}
      <div className="p-6 rounded-3xl bg-white/40 dark:bg-slate-900/50 backdrop-blur-xl border border-white/50 dark:border-white/10 shadow-xl shadow-indigo-950/5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/40 dark:border-white/10">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              全班成员与角色权限管理
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 font-medium">
              您可以直接在此调整指定同学的身份等级，修改后立即实时同步至全班
            </p>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="搜索姓名 / 学号 / 邮箱"
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200/70 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-white/60 dark:bg-slate-800/60 border-b border-white/40 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-200">
                <th className="p-3">成员姓名</th>
                <th className="p-3">学号</th>
                <th className="p-3">公历生日</th>
                <th className="p-3">当前身份</th>
                <th className="p-3 text-right">角色权限指派</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/40 dark:divide-slate-800 text-slate-800 dark:text-slate-200 font-medium">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 font-medium">
                    暂无匹配的同学记录
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.uid} className="hover:bg-white/40 dark:hover:bg-white/5 transition-colors">
                    <td className="p-3 flex items-center gap-2.5">
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 shrink-0 border border-white/50"
                      />
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">
                          {user.name}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {user.email}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 font-mono text-slate-600 dark:text-slate-400">
                      {user.studentId || '-'}
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-400">
                      {user.birthday || '-'}
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        user.role === 'super_admin'
                          ? 'bg-rose-500/20 text-rose-900 dark:text-rose-300 border-rose-400/30'
                          : user.role === 'committee'
                            ? 'bg-amber-500/20 text-amber-900 dark:text-amber-300 border-amber-400/30'
                            : 'bg-white/70 text-slate-700 dark:bg-slate-800/70 dark:text-slate-300 border-white/40 dark:border-white/10'
                      }`}>
                        {ROLE_NAMES[user.role]}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.uid, e.target.value as UserRole)}
                        className="px-3 py-1.5 text-xs rounded-xl border border-slate-200/70 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 backdrop-blur-md text-slate-900 dark:text-slate-100 font-medium"
                      >
                        <option value="super_admin">👑 超级管理员</option>
                        <option value="committee">⭐ 班委会委员</option>
                        <option value="member">👤 普通成员</option>
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: General Class Space Settings */}
      <div className="p-6 rounded-3xl bg-white/40 dark:bg-slate-900/50 backdrop-blur-xl border border-white/50 dark:border-white/10 shadow-xl shadow-indigo-950/5 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 pb-2 border-b border-white/40 dark:border-white/10">
          <Edit className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          班级空间基本资料配置
        </h3>

        <form onSubmit={handleSaveGeneralSettings} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                班级全称
              </label>
              <input
                type="text"
                value={settings.className}
                onChange={(e) => setSettings({ ...settings, className: e.target.value })}
                className="w-full px-3.5 py-2.5 text-xs rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 backdrop-blur-md text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                当前学期
              </label>
              <input
                type="text"
                value={settings.semester}
                onChange={(e) => setSettings({ ...settings, semester: e.target.value })}
                className="w-full px-3.5 py-2.5 text-xs rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 backdrop-blur-md text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              班级口号 / 寄语
            </label>
            <input
              type="text"
              value={settings.motto}
              onChange={(e) => setSettings({ ...settings, motto: e.target.value })}
              className="w-full px-3.5 py-2.5 text-xs rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 backdrop-blur-md text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              班级顶部轮播广播公告
            </label>
            <textarea
              rows={2}
              value={settings.announcement}
              onChange={(e) => setSettings({ ...settings, announcement: e.target.value })}
              className="w-full px-3.5 py-2.5 text-xs rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 backdrop-blur-md text-slate-900 dark:text-slate-100 resize-none"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            {saveSuccess && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4" />
                班级设置已实时更新保存！
              </span>
            )}
            <button
              type="submit"
              className="ml-auto px-6 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-lg shadow-indigo-600/30 border border-white/20 active:scale-95"
            >
              保存班级全局资料
            </button>
          </div>
        </form>
      </div>

      {/* Section 3: Cloudflare R2 & Worker Integration Guide */}
      <div className="p-6 rounded-3xl bg-white/40 dark:bg-slate-900/50 backdrop-blur-xl border border-white/50 dark:border-white/10 shadow-xl shadow-indigo-950/5 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/40 dark:border-white/10">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Cloud className="w-4 h-4 text-sky-500" />
              Cloudflare Pages & Worker & R2 部署与接口集成
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 font-medium">
              前端静态部署于 Cloudflare Pages，文件经由 Cloudflare Worker 代理存入 R2 存储桶
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Cloudflare Worker 上传端点 (URL)
            </label>
            <input
              type="text"
              value={settings.cloudflareWorkerUrl || ''}
              onChange={(e) => setSettings({ ...settings, cloudflareWorkerUrl: e.target.value })}
              placeholder="https://your-worker.workers.dev/upload"
              className="w-full px-3.5 py-2.5 text-xs rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 backdrop-blur-md text-slate-900 dark:text-slate-100 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Cloudflare R2 Bucket 名称
            </label>
            <input
              type="text"
              value={settings.r2BucketName || ''}
              onChange={(e) => setSettings({ ...settings, r2BucketName: e.target.value })}
              placeholder="class-space-bucket"
              className="w-full px-3.5 py-2.5 text-xs rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 backdrop-blur-md text-slate-900 dark:text-slate-100 font-mono"
            />
          </div>
        </div>

        {/* Worker Code Snippet */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Cloudflare Worker 脚本代码模版
            </span>
            <button
              onClick={copyWorkerCode}
              className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
            >
              {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? '已复制到剪贴板' : '一键复制代码'}
            </button>
          </div>
          <pre className="p-4 bg-slate-900/90 dark:bg-slate-950/90 text-indigo-200 rounded-2xl text-[11px] font-mono overflow-x-auto leading-relaxed border border-white/10 shadow-inner">
            {workerCodeSnippet}
          </pre>
        </div>
      </div>
    </div>
  );
};
