import React, { lazy, Suspense, useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Sidebar, BASE_NAV_ITEMS, ADMIN_NAV_ITEM } from './components/Sidebar';
import { NoticeModule } from './components/NoticeModule';
import { ClassSettings } from './types';
import { subscribeToSettings } from './services/firestoreService';
import { X, User, Crown, LockKeyhole, LogIn } from 'lucide-react';

const BirthdayModule = lazy(() => import('./components/BirthdayModule').then((module) => ({ default: module.BirthdayModule })));
const CalendarModule = lazy(() => import('./components/CalendarModule').then((module) => ({ default: module.CalendarModule })));
const ChatModule = lazy(() => import('./components/ChatModule').then((module) => ({ default: module.ChatModule })));
const PollModule = lazy(() => import('./components/PollModule').then((module) => ({ default: module.PollModule })));
const FormCollectionModule = lazy(() => import('./components/FormCollectionModule').then((module) => ({ default: module.FormCollectionModule })));
const FeedbackModule = lazy(() => import('./components/FeedbackModule').then((module) => ({ default: module.FeedbackModule })));
const ProfileModule = lazy(() => import('./components/ProfileModule').then((module) => ({ default: module.ProfileModule })));
const SettingsModule = lazy(() => import('./components/SettingsModule').then((module) => ({ default: module.SettingsModule })));
const AuthModal = lazy(() => import('./components/AuthModal').then((module) => ({ default: module.AuthModal })));

const ModuleFallback = () => (
  <div className="min-h-48 flex items-center justify-center text-xs font-semibold text-slate-500 dark:text-slate-400">
    正在加载模块...
  </div>
);

function MainAppContent() {
  const { currentUser, profile, loading, accessError, isSuperAdmin, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('notice');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [dismissAnnouncement, setDismissAnnouncement] = useState(false);

  const [settings, setSettings] = useState<ClassSettings>({
    className: '班级空间',
    motto: '',
    semester: '',
    announcement: ''
  });

  useEffect(() => {
    if (!currentUser || !profile) return;
    const unsub = subscribeToSettings((data) => setSettings(data));
    return () => unsub();
  }, [currentUser, profile]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 gap-3">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold">正在通过班级服务验证访问权限...</p>
        <p className="text-[11px] text-slate-400">手机无需连接 Google，验证超时后可直接重试</p>
        <button
          type="button"
          onClick={() => void logout().catch(() => window.location.reload())}
          className="mt-2 rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
        >
          取消验证并重新登录
        </button>
      </div>
    );
  }

  if (!currentUser || !profile) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-5 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(79,70,229,0.24),_transparent_48%)]" />
        <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.06] p-7 sm:p-9 shadow-2xl backdrop-blur-xl text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/15 ring-1 ring-indigo-300/25">
            <LockKeyhole className="h-8 w-8 text-indigo-300" />
          </div>
          <p className="text-xs font-bold tracking-[0.28em] text-indigo-300">PRIVATE SPACE</p>
          <h1 className="mt-3 text-2xl font-black">私人班级空间</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            已批准的班级成员可访问。新同学可以先提交注册申请，审批前不会加载或显示任何班级数据。
          </p>
          {accessError && (
            <div className="mt-5 rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {accessError}
            </div>
          )}
          <button
            onClick={() => setShowAuthModal(true)}
            className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-bold shadow-lg shadow-indigo-950/40 transition hover:bg-indigo-400"
          >
            <LogIn className="h-4 w-4" />
            登录或注册
          </button>
          <p className="mt-4 text-xs text-slate-500">注册后需等待管理员核对姓名和学号并批准。</p>
        </div>

        {showAuthModal && (
          <Suspense fallback={null}>
            <AuthModal isOpen onClose={() => setShowAuthModal(false)} />
          </Suspense>
        )}
      </div>
    );
  }

  const currentNavItems = isSuperAdmin 
    ? [...BASE_NAV_ITEMS, ADMIN_NAV_ITEM] 
    : BASE_NAV_ITEMS;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans pb-16 lg:pb-8 relative">
      {/* Subtle atmospheric ambient lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-indigo-100/50 dark:bg-indigo-950/20 rounded-full blur-3xl" />
      </div>

      {/* Top Navbar */}
      <Navbar
        settings={settings}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAuth={() => {
          setShowAuthModal(true);
        }}
        onOpenProfile={() => {
          setActiveTab('profile');
        }}
      />

      {/* Broadcast Marquee Banner */}
      {!dismissAnnouncement && settings.announcement && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 mt-3">
          <div className="bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-950/60 text-slate-900 dark:text-white px-4 py-2.5 text-xs rounded-xl flex items-center justify-between shadow-xs">
            <div className="flex-1 flex items-center gap-2.5 overflow-hidden">
              <span className="flex h-2 w-2 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              <span className="font-bold text-indigo-700 dark:text-indigo-400 shrink-0">班级广播：</span>
              <span className="truncate text-slate-700 dark:text-slate-300 font-medium">{settings.announcement}</span>
            </div>
            <button
              onClick={() => setDismissAnnouncement(true)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 ml-2 p-1 rounded-md transition-colors"
              title="关闭广播"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Mobile Horizontal Module Switcher */}
      <div className="lg:hidden mx-4 mt-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1.5 overflow-x-auto flex items-center gap-1 scrollbar-none shadow-xs">
        {currentNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.name}</span>
            </button>
          );
        })}
      </div>

      {/* Main Container */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-5 flex-1 flex gap-6">
        {/* Desktop Sidebar */}
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Dynamic Content Panel */}
        <div className="flex-1 min-w-0">
          <Suspense fallback={<ModuleFallback />}>
            {activeTab === 'notice' && <NoticeModule settings={settings} />}
            {activeTab === 'birthday' && <BirthdayModule />}
            {activeTab === 'calendar' && <CalendarModule settings={settings} />}
            {activeTab === 'chat' && <ChatModule />}
            {activeTab === 'poll' && <PollModule />}
            {activeTab === 'forms' && <FormCollectionModule />}
            {activeTab === 'feedback' && <FeedbackModule />}
            {activeTab === 'profile' && <ProfileModule />}
            {activeTab === 'settings' && <SettingsModule />}
          </Suspense>
        </div>
      </main>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 flex items-center justify-around shadow-lg">
        {BASE_NAV_ITEMS.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-0.5 p-1 text-[10px] font-medium transition-colors ${
                isActive ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.name}</span>
            </button>
          );
        })}
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center gap-0.5 p-1 text-[10px] font-medium transition-colors ${
            activeTab === 'profile' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <User className="w-4 h-4" />
          <span>我的资料</span>
        </button>
        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center gap-0.5 p-1 text-[10px] font-medium transition-colors ${
              activeTab === 'settings' ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <Crown className="w-4 h-4 text-amber-500" />
            <span>管理</span>
          </button>
        )}
      </nav>

      {/* Auth Modal */}
      {showAuthModal && (
        <Suspense fallback={null}>
          <AuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
          />
        </Suspense>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainAppContent />
    </AuthProvider>
  );
}
