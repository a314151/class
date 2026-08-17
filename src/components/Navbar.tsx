import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  User, 
  LogOut, 
  LogIn, 
  Crown, 
  ChevronDown
} from 'lucide-react';
import { ClassSettings } from '../types';

interface NavbarProps {
  settings: ClassSettings;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenAuth: () => void;
  onOpenProfile: () => void;
  unreadCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  settings,
  activeTab,
  setActiveTab,
  onOpenAuth,
  onOpenProfile,
  unreadCount = 0
}) => {
  const { profile, logout, isSuperAdmin } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
        {/* Left: Class Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-xs">
            班
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                {settings.className}
              </h1>
              <span className="hidden sm:inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {settings.semester}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-xs sm:max-w-sm hidden sm:block">
              {settings.motto}
            </p>
          </div>
        </div>

        {/* Right: User Profile & Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {profile ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1.5 pr-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
              >
                <img
                  src={profile.avatar}
                  alt={profile.name}
                  className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 dark:border-slate-700 object-cover"
                />
                <div className="hidden sm:block text-left pr-1">
                  <div className="text-xs font-semibold text-slate-900 dark:text-white leading-none">
                    {profile.name}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {isSuperAdmin ? '👑 超级管理员' : profile.role === 'committee' ? '⭐ 班委' : '👤 同学'}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Dropdown Menu */}
              {showUserMenu && (
                <div className="absolute right-0 mt-1.5 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-1.5 text-xs z-50 animate-in fade-in">
                  <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{profile.name}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">学号：{profile.studentId || '未设置'}</p>
                  </div>

                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      setActiveTab('profile');
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left font-medium mt-1"
                  >
                    <User className="w-3.5 h-3.5 text-indigo-500" />
                    个人中心 · 资料设置
                  </button>

                  {isSuperAdmin && (
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        setActiveTab('settings');
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors text-left font-medium"
                    >
                      <Crown className="w-3.5 h-3.5 text-amber-500" />
                      班级管理后台
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors text-left font-medium"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    退出当前账号
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              登录班级
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
