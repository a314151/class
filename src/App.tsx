import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Sidebar, BASE_NAV_ITEMS, ADMIN_NAV_ITEM } from './components/Sidebar';
import { NoticeModule } from './components/NoticeModule';
import { BirthdayModule } from './components/BirthdayModule';
import { CalendarModule } from './components/CalendarModule';
import { ChatModule } from './components/ChatModule';
import { PollModule } from './components/PollModule';
import { FormCollectionModule } from './components/FormCollectionModule';
import { FeedbackModule } from './components/FeedbackModule';
import { ProfileModule } from './components/ProfileModule';
import { SettingsModule } from './components/SettingsModule';
import { AuthModal } from './components/AuthModal';
import { ClassSettings } from './types';
import { subscribeToSettings } from './services/firestoreService';
import { Megaphone, Volume2, X, Sparkles, User, Crown } from 'lucide-react';

function MainAppContent() {
  const { profile, loading, isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('notice');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | 'profile'>('login');
  const [dismissAnnouncement, setDismissAnnouncement] = useState(false);

  const [settings, setSettings] = useState<ClassSettings>({
    className: '高三 (1) 班 · 卓越空间',
    motto: '博学笃行，求是拓新，追光而行',
    semester: '2026年 春季学期',
    announcement: '欢迎进入班级空间！期中模拟考与研学报名正在进行中，请及时查看通知与提交表格。',
    cloudflareWorkerUrl: 'https://class-space-worker.pages.dev/api/upload',
    r2BucketName: 'class-space-assets'
  });

  useEffect(() => {
    const unsub = subscribeToSettings((data) => setSettings(data));
    return () => unsub();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 gap-3">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold">正在同步班级空间数据...</p>
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
          setAuthModalMode('login');
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
          {activeTab === 'notice' && <NoticeModule />}
          {activeTab === 'birthday' && <BirthdayModule />}
          {activeTab === 'calendar' && <CalendarModule />}
          {activeTab === 'chat' && <ChatModule />}
          {activeTab === 'poll' && <PollModule />}
          {activeTab === 'forms' && <FormCollectionModule />}
          {activeTab === 'feedback' && <FeedbackModule />}
          {activeTab === 'profile' && <ProfileModule />}
          {activeTab === 'settings' && <SettingsModule />}
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
      <AuthModal
        isOpen={showAuthModal}
        initialMode={authModalMode}
        onClose={() => setShowAuthModal(false)}
      />
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
