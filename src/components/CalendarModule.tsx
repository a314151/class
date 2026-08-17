import React, { useState, useEffect, useRef } from 'react';
import { SchoolEvent, SchoolEventCategory } from '../types';
import { 
  subscribeToSchoolEvents, 
  addSchoolEvent, 
  deleteSchoolEvent 
} from '../services/firestoreService';
import { useAuth } from '../context/AuthContext';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Trash2, 
  MapPin, 
  Clock, 
  Filter,
  ChevronDown,
  X
} from 'lucide-react';

const EVENT_TYPE_MAP: Record<SchoolEventCategory, { label: string; badge: string }> = {
  holiday: { label: '法定节假', badge: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' },
  exam: { label: '统考测评', badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' },
  activity: { label: '校园活动', badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
  academic: { label: '学术教研', badge: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300' },
};

export const CalendarModule: React.FC = () => {
  const { isCommittee } = useAuth();
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // New Event Form
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [category, setCategory] = useState<SchoolEventCategory>('activity');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribeToSchoolEvents((data) => {
      setEvents(data);
    });
    return () => unsub();
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;

    setSubmitting(true);
    try {
      await addSchoolEvent({
        title: title.trim(),
        date,
        category,
        description: description.trim(),
        location: location.trim() || undefined
      });
      setTitle('');
      setDate('');
      setDescription('');
      setLocation('');
      setShowAddModal(false);
    } catch (err) {
      console.error('Failed to add school event:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const calculateDaysAway = (targetDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(targetDate);
    target.setHours(0, 0, 0, 0);
    const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const filteredEvents = selectedCategory === 'all'
    ? events
    : events.filter(e => e.category === selectedCategory);

  const currentCategoryLabel = selectedCategory === 'all'
    ? `全部校历 (${events.length})`
    : `${EVENT_TYPE_MAP[selectedCategory as SchoolEventCategory]?.label || selectedCategory} (${events.filter(e => e.category === selectedCategory).length})`;

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            学校校历与学期关键日程
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            涵盖全校重大教学日程、考试测评、节假日及校园活动时间轴
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          {/* Category Dropdown List - Click to expand */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 rounded-xl transition-colors border border-slate-200/60 dark:border-slate-700/60"
            >
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span>{currentCategoryLabel}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showCategoryDropdown && (
              <div className="absolute right-0 mt-1.5 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-1.5 text-xs z-30 animate-in fade-in">
                <button
                  onClick={() => {
                    setSelectedCategory('all');
                    setShowCategoryDropdown(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                    selectedCategory === 'all'
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>全部校历</span>
                  <span className="text-[10px] text-slate-400">{events.length}</span>
                </button>
                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                {Object.entries(EVENT_TYPE_MAP).map(([key, info]) => {
                  const count = events.filter(e => e.category === key).length;
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setSelectedCategory(key);
                        setShowCategoryDropdown(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                        selectedCategory === key
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>{info.label}</span>
                      <span className="text-[10px] text-slate-400">{count}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {isCommittee && (
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              添加事件
            </button>
          )}
        </div>
      </div>

      {/* Events Timeline List */}
      <div className="space-y-3">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-6">
            <CalendarIcon className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">暂无符合条件的校历记录</p>
            <p className="text-[11px] text-slate-400 mt-0.5">有新日程发布时将在此处自动排序显示</p>
          </div>
        ) : (
          filteredEvents.map((event) => {
            const typeInfo = EVENT_TYPE_MAP[event.category] || EVENT_TYPE_MAP.activity;
            const daysAway = calculateDaysAway(event.date);

            return (
              <div
                key={event.id}
                className="p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${typeInfo.badge}`}>
                        {typeInfo.label}
                      </span>
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                        {event.title}
                      </h3>
                    </div>

                    {event.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                        {event.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        日期：{event.date}
                      </span>
                      {event.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          地点：{event.location}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg ${
                      daysAway === 0
                        ? 'bg-rose-500 text-white'
                        : daysAway > 0
                          ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}>
                      {daysAway === 0 ? '今日进行' : daysAway > 0 ? `倒计时 ${daysAway} 天` : '已结束'}
                    </span>

                    {isCommittee && (
                      <button
                        onClick={() => {
                          if (window.confirm('确定要删除此条校历日程吗？')) {
                            deleteSchoolEvent(event.id);
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition-colors"
                        title="删除事件"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" />
                新增学校日历日程
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddEvent} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  日程名称 *
                </label>
                <input
                  type="text"
                  required
                  placeholder="例如：期中统考测试 / 校园秋季田径运动会"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    发生日期 *
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    事件类别
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as SchoolEventCategory)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    {Object.entries(EVENT_TYPE_MAP).map(([key, info]) => (
                      <option key={key} value={key}>{info.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  地点 / 考场 (选填)
                </label>
                <input
                  type="text"
                  placeholder="例如：主教学楼考场 / 田径场"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  详情说明
                </label>
                <textarea
                  rows={3}
                  placeholder="输入事件要求、注意事项或参与须知..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors font-medium"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors"
                >
                  {submitting ? '保存中...' : '确认添加'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
