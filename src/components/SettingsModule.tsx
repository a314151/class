import React, { useState, useEffect } from 'react';
import { 
  UserProfile, 
  ClassSettings, 
  UserRole,
  DirectMessage
} from '../types';
import { 
  subscribeToUsers, 
  updateUserRole, 
  subscribeToSettings, 
  saveSettings,
  setUserAccessDisabled,
  approveUserAccess,
  subscribeToAdminDirectMessages
} from '../services/firestoreService';
import { useAuth } from '../context/AuthContext';
import { ConfirmModal } from './ConfirmModal';
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
  Crown,
  Trash2,
  UserPlus,
  MessagesSquare,
  UserCheck
} from 'lucide-react';

const ROLE_NAMES: Record<UserRole, string> = {
  super_admin: '超级管理员 (班长/班主任)',
  committee: '班委会委员 (学委/文娱/团支书)',
  member: '普通班级成员 (同学)'
};

export const SettingsModule: React.FC = () => {
  const { profile, isSuperAdmin, createManagedMember } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [searchUser, setSearchUser] = useState('');
  const [settings, setSettings] = useState<ClassSettings>({
    className: '班级空间',
    motto: '',
    semester: '',
    announcement: ''
  });
  const [copied, setCopied] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [newMember, setNewMember] = useState({
    studentId: '',
    name: '',
    email: '',
    password: '',
    role: 'member' as Exclude<UserRole, 'super_admin'>
  });
  const [creatingMember, setCreatingMember] = useState(false);
  const [memberNotice, setMemberNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const unsubUsers = subscribeToUsers((data) => setUsers(data));
    const unsubSettings = subscribeToSettings((data) => setSettings(data));
    const unsubDirectMessages = subscribeToAdminDirectMessages((data) => setDirectMessages(data));
    return () => {
      unsubUsers();
      unsubSettings();
      unsubDirectMessages();
    };
  }, [isSuperAdmin]);

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

  const handleCreateMember = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreatingMember(true);
    setMemberNotice(null);
    try {
      const created = await createManagedMember(newMember);
      setMemberNotice(`已开通 ${created.name}（${created.studentId}）的访问权限`);
      setNewMember({ studentId: '', name: '', email: '', password: '', role: 'member' });
    } catch (error) {
      setMemberNotice(error instanceof Error ? error.message : '创建成员失败，请重试');
    } finally {
      setCreatingMember(false);
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

  const handleDeleteUser = async (u: UserProfile) => {
    try {
      const documentId = u.profileDocId || u.uid;
      if (u.approved !== true) {
        await approveUserAccess(documentId);
      } else {
        await setUserAccessDisabled(documentId, !u.disabled);
      }
      setUserToDelete(null);
    } catch (e) {
      console.error('Delete user error:', e);
    }
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

          <p className="rounded-2xl bg-slate-100 px-4 py-3 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            管理权限只认已验证的管理员 Google 账号，已移除本地口令解锁入口。
          </p>
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

      {/* Create managed member */}
      <div className="p-6 rounded-3xl bg-white/40 dark:bg-slate-900/50 backdrop-blur-xl border border-white/50 dark:border-white/10 shadow-xl shadow-indigo-950/5 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            开通成员账号
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
            账号只能由你创建。把学号和初始密码私下交给同学，网页不再开放自助注册。
          </p>
        </div>
        <form onSubmit={handleCreateMember} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            required
            value={newMember.studentId}
            onChange={(e) => setNewMember({ ...newMember, studentId: e.target.value })}
            placeholder="学号 *"
            className="px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800"
          />
          <input
            required
            value={newMember.name}
            onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
            placeholder="姓名 *"
            className="px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800"
          />
          <input
            type="email"
            value={newMember.email}
            onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
            placeholder="联系邮箱（可选，仅作资料）"
            className="px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800"
          />
          <input
            required
            minLength={8}
            type="password"
            value={newMember.password}
            onChange={(e) => setNewMember({ ...newMember, password: e.target.value })}
            placeholder="初始密码（至少 8 位）*"
            className="px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800"
          />
          <select
            value={newMember.role}
            onChange={(e) => setNewMember({ ...newMember, role: e.target.value as Exclude<UserRole, 'super_admin'> })}
            className="px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800"
          >
            <option value="member">普通成员</option>
            <option value="committee">班委会委员</option>
          </select>
          <button
            type="submit"
            disabled={creatingMember}
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            {creatingMember ? '正在创建...' : '创建并批准访问'}
          </button>
        </form>
        {memberNotice && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-xs font-semibold text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-300">
            {memberNotice}
          </div>
        )}
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
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-60">
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
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-white/60 dark:bg-slate-800/60 border-b border-white/40 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-200">
                <th className="p-3">成员姓名</th>
                <th className="p-3">学号</th>
                <th className="p-3">公历生日</th>
                <th className="p-3">当前身份</th>
                <th className="p-3">角色权限指派</th>
                <th className="p-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/40 dark:divide-slate-800 text-slate-800 dark:text-slate-200 font-medium">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 font-medium">
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
                        <span className="text-[9px] text-slate-400 font-mono block" title="Firebase Auth UID">
                          UID: {user.authUid || user.uid}
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
                        !user.authUid
                          ? 'bg-slate-500/20 text-slate-700 dark:text-slate-300 border-slate-400/30'
                          : user.approved !== true
                          ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-400/30'
                          : user.disabled
                          ? 'bg-slate-500/20 text-slate-700 dark:text-slate-300 border-slate-400/30'
                          : user.role === 'super_admin'
                          ? 'bg-rose-500/20 text-rose-900 dark:text-rose-300 border-rose-400/30'
                          : user.role === 'committee'
                            ? 'bg-amber-500/20 text-amber-900 dark:text-amber-300 border-amber-400/30'
                            : 'bg-white/70 text-slate-700 dark:bg-slate-800/70 dark:text-slate-300 border-white/40 dark:border-white/10'
                      }`}>
                        {!user.authUid ? '未绑定登录账号' : user.approved !== true ? '待管理员批准' : user.disabled ? '已撤销访问' : ROLE_NAMES[user.role]}
                      </span>
                    </td>
                    <td className="p-3">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.profileDocId || user.uid, e.target.value as UserRole)}
                        disabled={user.role === 'super_admin' || user.disabled || user.approved !== true}
                        className="px-3 py-1.5 text-xs rounded-xl border border-slate-200/70 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 backdrop-blur-md text-slate-900 dark:text-slate-100 font-medium"
                      >
                        {user.role === 'super_admin' && <option value="super_admin">👑 超级管理员</option>}
                        <option value="committee">⭐ 班委会委员</option>
                        <option value="member">👤 普通成员</option>
                      </select>
                    </td>
                    <td className="p-3 text-right">
                      {user.role !== 'super_admin' && user.authUid ? (
                        <button
                          onClick={() => setUserToDelete(user)}
                          title={user.approved !== true ? '批准该账号访问' : user.disabled ? '恢复该账号访问' : '撤销该账号访问'}
                          className={`p-1.5 rounded-lg transition-colors ${user.approved !== true || user.disabled ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40' : 'text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'}`}
                        >
                          {user.approved !== true || user.disabled ? <UserCheck className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      ) : user.role !== 'super_admin' ? (
                        <span className="text-[10px] text-slate-400" title="请使用上方“开通成员账号”重新创建登录账号">
                          需开通账号
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin-only complete direct-message audit */}
      <div className="p-6 rounded-3xl bg-white/40 dark:bg-slate-900/50 backdrop-blur-xl border border-white/50 dark:border-white/10 shadow-xl shadow-indigo-950/5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <MessagesSquare className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              管理员数据调试 · 全部私聊
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
              仅你的管理员账号可读取。普通成员只能读取自己参与的私聊；这里显示最近 200 条用于排错。
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-violet-500/15 px-2.5 py-1 text-[10px] font-bold text-violet-700 dark:text-violet-300">
            {directMessages.length} 条
          </span>
        </div>
        <div className="max-h-80 overflow-auto rounded-2xl border border-slate-200/70 dark:border-slate-700">
          {directMessages.length === 0 ? (
            <p className="p-6 text-center text-xs text-slate-500">暂无私聊记录</p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="p-2.5">时间</th>
                  <th className="p-2.5">发送者 → 接收者</th>
                  <th className="p-2.5">内容</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
                {directMessages.map((message) => (
                  <tr key={message.id} className="align-top">
                    <td className="p-2.5 whitespace-nowrap text-[10px] text-slate-500">
                      {new Date(message.createdAt).toLocaleString('zh-CN')}
                    </td>
                    <td className="p-2.5 font-mono text-[10px] text-slate-500">
                      {message.senderName || message.senderUid} → {message.recipientUid}
                    </td>
                    <td className="p-2.5 text-slate-700 dark:text-slate-200 break-words max-w-sm">
                      {message.content || (message.attachmentUrl ? '[附件]' : '[空消息]')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Section 2: General Class Space Settings */}
      <div className="p-6 rounded-3xl bg-white/40 dark:bg-slate-900/50 backdrop-blur-xl border border-white/50 dark:border-white/10 shadow-xl shadow-indigo-950/5 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/40 dark:border-white/10">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Edit className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              班级空间基本资料配置
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 font-medium">
              修改后将实时同步至全班导航栏、公告头条与主页展示（支持即时保存与离线持久化）
            </p>
          </div>
          {saveSuccess && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 animate-in fade-in bg-emerald-500/15 px-3 py-1 rounded-xl border border-emerald-500/30">
              <CheckCircle2 className="w-3.5 h-3.5" />
              已保存并实时同步
            </span>
          )}
        </div>

        <form onSubmit={handleSaveGeneralSettings} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                班级全称 *
              </label>
              <input
                type="text"
                required
                value={settings.className}
                onChange={(e) => setSettings({ ...settings, className: e.target.value })}
                onBlur={() => saveSettings(settings).catch(() => {})}
                placeholder="例如：高三 (1) 班 · 卓越空间"
                className="w-full px-3.5 py-2.5 text-xs rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 backdrop-blur-md text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                当前学期 *
              </label>
              <input
                type="text"
                required
                value={settings.semester}
                onChange={(e) => setSettings({ ...settings, semester: e.target.value })}
                onBlur={() => saveSettings(settings).catch(() => {})}
                placeholder="例如：2026年 春季学期"
                className="w-full px-3.5 py-2.5 text-xs rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 backdrop-blur-md text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all font-semibold"
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
              onBlur={() => saveSettings(settings).catch(() => {})}
              placeholder="例如：博学笃行，求是拓新，追光而行"
              className="w-full px-3.5 py-2.5 text-xs rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 backdrop-blur-md text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
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
              onBlur={() => saveSettings(settings).catch(() => {})}
              placeholder="输入全班置顶轮播广播语..."
              className="w-full px-3.5 py-2.5 text-xs rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 backdrop-blur-md text-slate-900 dark:text-slate-100 resize-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              💡 离开输入框时已自动保存，亦可点击右侧按钮立即确认提交
            </span>
            <button
              type="submit"
              className="px-6 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-lg shadow-indigo-600/30 border border-white/20 active:scale-95 transition-all flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              保存并同步全班
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

      {/* Confirm Delete User Account Modal */}
      <ConfirmModal
        isOpen={Boolean(userToDelete)}
        title={userToDelete?.approved !== true ? '批准该成员访问？' : userToDelete?.disabled ? '恢复该成员访问？' : '撤销该成员访问？'}
        message={userToDelete?.approved !== true
          ? `确认批准 ${userToDelete?.name}（学号：${userToDelete?.studentId || '无'}）访问班级空间？请先核对姓名、学号和 Auth UID。`
          : userToDelete?.disabled
          ? `恢复 ${userToDelete?.name}（学号：${userToDelete?.studentId || '无'}）的班级空间访问权限？`
          : `撤销 ${userToDelete?.name}（学号：${userToDelete?.studentId || '无'}）的访问权限？账号资料会保留在管理员后台，之后可以恢复。`}
        confirmText={userToDelete?.approved !== true ? '确认批准' : userToDelete?.disabled ? '确认恢复' : '确认撤销'}
        onConfirm={async () => {
          if (userToDelete) {
            await handleDeleteUser(userToDelete);
          }
        }}
        onClose={() => setUserToDelete(null)}
      />
    </div>
  );
};
