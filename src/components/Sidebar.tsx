import React from 'react';
import { 
  Megaphone, 
  Cake, 
  Calendar, 
  MessageSquare, 
  Vote, 
  ClipboardList, 
  Inbox, 
  User,
  Crown,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export interface NavItem {
  id: string;
  name: string;
  icon: React.FC<{ className?: string }>;
  badge?: string;
  description: string;
  adminOnly?: boolean;
}

export const BASE_NAV_ITEMS: NavItem[] = [
  { id: 'notice', name: '重要通知', icon: Megaphone, description: '全班公告与置顶' },
  { id: 'birthday', name: '生日祝福', icon: Cake, description: '同学生日与庆生' },
  { id: 'calendar', name: '学校日历', icon: Calendar, description: '校历重大节点' },
  { id: 'chat', name: '班级大厅', icon: MessageSquare, description: '实时交流与私聊' },
  { id: 'poll', name: '民主投票', icon: Vote, description: '班级表决与决策' },
  { id: 'forms', name: '表格征集', icon: ClipboardList, description: '问卷填报与导出' },
  { id: 'feedback', name: '意见信箱', icon: Inbox, description: '建议反馈与答复' },
  { id: 'profile', name: '个人中心', icon: User, description: '我的头像与资料' }
];

export const ADMIN_NAV_ITEM: NavItem = {
  id: 'settings',
  name: '班级管理',
  icon: Crown,
  badge: '超管',
  description: '全班权限与系统配置',
  adminOnly: true
};

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { profile, isSuperAdmin } = useAuth();

  const navItems = isSuperAdmin 
    ? [...BASE_NAV_ITEMS, ADMIN_NAV_ITEM]
    : BASE_NAV_ITEMS;

  return (
    <aside className="w-60 shrink-0 hidden lg:block space-y-4">
      {/* Navigation list */}
      <div className="p-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-0.5">
        <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          班级空间模块
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors text-left ${
                isActive
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : item.adminOnly ? 'text-amber-500' : 'text-slate-400 dark:text-slate-500'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={item.adminOnly && !isActive ? 'text-amber-700 dark:text-amber-400' : ''}>
                    {item.name}
                  </span>
                  {item.badge && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-semibold ${
                      isActive ? 'bg-indigo-200/60 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-100' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </div>
                <p className={`text-[10px] font-normal truncate mt-0.5 ${isActive ? 'text-indigo-600/80 dark:text-indigo-300/80' : 'text-slate-400 dark:text-slate-500'}`}>
                  {item.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Role Card in Sidebar */}
      <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 text-xs space-y-1.5 shadow-xs">
        <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
          <span>当前身份</span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
            isSuperAdmin 
              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300'
              : profile?.role === 'committee'
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
          }`}>
            {isSuperAdmin ? '👑 超管' : profile?.role === 'committee' ? '⭐ 班委' : '👤 同学'}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          {isSuperAdmin
            ? '拥有全局配置、成员权限分配与班级全部模块管理权限。'
            : profile?.role === 'committee'
              ? '可发布通知公告、发起民主投票及发起收集表单。'
              : '可维护个人资料档案，参与班级投票、表单填报与实时交流。'}
        </p>
      </div>
    </aside>
  );
};
