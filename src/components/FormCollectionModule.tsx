import React, { useState, useEffect, useRef } from 'react';
import { FormCollection, FormField, FormSubmission } from '../types';
import { 
  subscribeToForms, 
  addForm, 
  submitFormResponse, 
  deleteForm 
} from '../services/firestoreService';
import { useAuth } from '../context/AuthContext';
import { R2UploadButton } from './R2UploadButton';
import { 
  ClipboardList, 
  Plus, 
  Download, 
  CheckCircle2, 
  Clock, 
  Trash2, 
  Eye, 
  ChevronDown,
  MoreVertical,
  X
} from 'lucide-react';

export const FormCollectionModule: React.FC = () => {
  const { profile, isCommittee } = useAuth();
  const [forms, setForms] = useState<FormCollection[]>([]);
  const [activeForm, setActiveForm] = useState<FormCollection | null>(null);
  const [showFormDropdown, setShowFormDropdown] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewSubmissionsForm, setViewSubmissionsForm] = useState<FormCollection | null>(null);

  // Form fill state
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // New Form Creator state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [fields, setFields] = useState<FormField[]>([
    { id: 'f_1', label: '真实姓名', type: 'text', required: true, placeholder: '请输入你的姓名' },
    { id: 'f_2', label: '学号', type: 'text', required: true, placeholder: '请输入学号' }
  ]);

  const formDropdownRef = useRef<HTMLDivElement>(null);
  const moreActionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribeToForms((data) => {
      setForms(data);
      if (data.length > 0) {
        if (!activeForm || !data.some(f => f.id === activeForm.id)) {
          setActiveForm(data[0]);
        }
      } else {
        setActiveForm(null);
      }
    });
    return () => unsub();
  }, []);

  // Update formData when activeForm or profile changes
  useEffect(() => {
    if (activeForm && profile && activeForm.submissions && activeForm.submissions[profile.uid]) {
      setFormData(activeForm.submissions[profile.uid].answers || {});
    } else {
      setFormData({});
    }
  }, [activeForm, profile]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (formDropdownRef.current && !formDropdownRef.current.contains(event.target as Node)) {
        setShowFormDropdown(false);
      }
      if (moreActionsRef.current && !moreActionsRef.current.contains(event.target as Node)) {
        setShowMoreActions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddField = () => {
    const newField: FormField = {
      id: `f_${Date.now()}`,
      label: '新填报项',
      type: 'text',
      required: true,
      placeholder: '请输入内容'
    };
    setFields([...fields, newField]);
  };

  const handleCreateForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || fields.length === 0 || !profile) return;

    setSubmitting(true);
    try {
      await addForm({
        title: newTitle.trim(),
        description: newDesc.trim(),
        fields,
        deadline: newDeadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        authorUid: profile.uid,
        authorName: profile.name,
        createdAt: new Date().toISOString()
      });
      setNewTitle('');
      setNewDesc('');
      setNewDeadline('');
      setShowCreateModal(false);
    } catch (err) {
      console.error('Failed to create form:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeForm || !profile) return;

    setSubmitting(true);
    try {
      const submission: FormSubmission = {
        studentUid: profile.uid,
        studentName: profile.name,
        studentId: profile.studentId || '未填写',
        submittedAt: new Date().toISOString(),
        answers: formData
      };

      await submitFormResponse(activeForm.id, submission);
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to submit form:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const exportToCSV = (form: FormCollection) => {
    if (!form.submissions || Object.keys(form.submissions).length === 0) {
      alert('暂无提交数据可导出');
      return;
    }

    const headers = ['学号', '姓名', '提交时间', ...form.fields.map(f => f.label)];
    const rows = Object.values(form.submissions).map(sub => {
      const answers = form.fields.map(f => {
        const val = sub.answers[f.id];
        return Array.isArray(val) ? val.join(';') : (val ?? '');
      });
      return [sub.studentId, sub.studentName, new Date(sub.submittedAt).toLocaleString(), ...answers];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${form.title}_填报结果.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hasSubmittedActive = Boolean(activeForm && profile && activeForm.submissions && activeForm.submissions[profile.uid]);
  const activeSubmissionsCount = activeForm?.submissions ? Object.keys(activeForm.submissions).length : 0;

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            表格与班级信息征集
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            保险投保、尺码统计、考场意向等表单收集与一键导出
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          {/* Form Selector Dropdown */}
          {forms.length > 0 && (
            <div className="relative" ref={formDropdownRef}>
              <button
                type="button"
                onClick={() => setShowFormDropdown(!showFormDropdown)}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 rounded-xl transition-colors border border-slate-200/60 dark:border-slate-700/60 max-w-[200px] truncate"
              >
                <span className="truncate">{activeForm ? activeForm.title : '选择表单'}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>

              {showFormDropdown && (
                <div className="absolute right-0 mt-1.5 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-1.5 text-xs z-30 animate-in fade-in max-h-60 overflow-y-auto">
                  {forms.map((f) => {
                    const isSelected = activeForm?.id === f.id;
                    const count = Object.keys(f.submissions || {}).length;
                    return (
                      <button
                        key={f.id}
                        onClick={() => {
                          setActiveForm(f);
                          setShowFormDropdown(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors ${
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="truncate pr-2">{f.title}</span>
                        <span className="text-[10px] text-slate-400 shrink-0">{count}份</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Committee Action Dropdown */}
          {isCommittee && activeForm && (
            <div className="relative" ref={moreActionsRef}>
              <button
                type="button"
                onClick={() => setShowMoreActions(!showMoreActions)}
                className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700/60"
                title="表单管理选项"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showMoreActions && (
                <div className="absolute right-0 mt-1.5 w-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-1 text-xs z-30 animate-in fade-in space-y-0.5">
                  <button
                    onClick={() => {
                      exportToCSV(activeForm);
                      setShowMoreActions(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-left"
                  >
                    <Download className="w-3.5 h-3.5 text-indigo-500" />
                    <span>导出 CSV 表格</span>
                  </button>
                  <button
                    onClick={() => {
                      setViewSubmissionsForm(activeForm);
                      setShowMoreActions(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-left"
                  >
                    <Eye className="w-3.5 h-3.5 text-emerald-500" />
                    <span>查看已收名单</span>
                  </button>
                  <div className="border-t border-slate-100 dark:border-slate-800 my-0.5" />
                  <button
                    onClick={() => {
                      setShowMoreActions(false);
                      if (window.confirm('确定要删除此项征集表单吗？')) {
                        deleteForm(activeForm.id);
                      }
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg text-left font-medium"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    <span>删除表单</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Create Form Button */}
          {isCommittee && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              创建表单
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {activeForm ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-6 shadow-xs space-y-5">
          {/* Active Form Header Info */}
          <div className="pb-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {activeForm.title}
                </h3>
                {hasSubmittedActive && (
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 px-2 py-0.5 rounded-md">
                    已填报
                  </span>
                )}
              </div>
              {activeForm.description && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  {activeForm.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 text-[11px] text-slate-400 shrink-0">
              <span>已收 {activeSubmissionsCount} 份</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                截止：{activeForm.deadline}
              </span>
            </div>
          </div>

          {/* Form Dynamic Inputs */}
          <form onSubmit={handleSubmitResponse} className="space-y-4 max-w-2xl">
            {activeForm.fields.map((field) => (
              <div key={field.id} className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {field.label} {field.required && <span className="text-rose-500">*</span>}
                </label>

                {/* Text Field */}
                {field.type === 'text' && (
                  <input
                    type="text"
                    required={field.required}
                    placeholder={field.placeholder || '请输入内容'}
                    value={formData[field.id] || ''}
                    onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                )}

                {/* Number Field */}
                {field.type === 'number' && (
                  <input
                    type="number"
                    required={field.required}
                    placeholder={field.placeholder || '请输入数值'}
                    value={formData[field.id] || ''}
                    onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                )}

                {/* Textarea */}
                {field.type === 'textarea' && (
                  <textarea
                    rows={3}
                    required={field.required}
                    placeholder={field.placeholder || '请输入详细说明'}
                    value={formData[field.id] || ''}
                    onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                )}

                {/* Radio Options */}
                {field.type === 'radio' && (
                  <div className="space-y-1.5 pt-0.5">
                    {field.options?.map((opt, i) => (
                      <label key={i} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="radio"
                          name={field.id}
                          required={field.required}
                          checked={formData[field.id] === opt}
                          onChange={() => setFormData({ ...formData, [field.id]: opt })}
                          className="text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                )}

                {/* File Attachment Upload */}
                {field.type === 'file' && (
                  <div className="flex items-center gap-3 pt-0.5">
                    <R2UploadButton
                      onUploaded={(url) => setFormData({ ...formData, [field.id]: url })}
                      buttonText="上传附件/凭据"
                    />
                    {formData[field.id] && (
                      <span className="text-xs text-emerald-600 font-semibold truncate">
                        已上传附件
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              {submitSuccess ? (
                <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  已保存并提交成功！
                </span>
              ) : <div />}

              <button
                type="submit"
                disabled={submitting || !profile}
                className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors"
              >
                {submitting ? '提交中...' : hasSubmittedActive ? '更新我的填报内容' : '确认提交表单'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-6">
          <ClipboardList className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">暂无进行中的征集表单</p>
          <p className="text-[11px] text-slate-400 mt-0.5">班委发布新统计或征集时将在此处显示</p>
        </div>
      )}

      {/* Submissions List Modal */}
      {viewSubmissionsForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                已收填报名单 · {viewSubmissionsForm.title} ({Object.keys(viewSubmissionsForm.submissions || {}).length}人)
              </h3>
              <button
                onClick={() => setViewSubmissionsForm(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200">
                    <th className="p-2.5">学号</th>
                    <th className="p-2.5">姓名</th>
                    <th className="p-2.5">提交时间</th>
                    {viewSubmissionsForm.fields.map(f => (
                      <th key={f.id} className="p-2.5">{f.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                  {Object.values(viewSubmissionsForm.submissions || {}).map((sub: FormSubmission, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-2.5 text-slate-500">{sub.studentId}</td>
                      <td className="p-2.5 font-semibold text-slate-900 dark:text-white">{sub.studentName}</td>
                      <td className="p-2.5 text-slate-400">{new Date(sub.submittedAt).toLocaleString()}</td>
                      {viewSubmissionsForm.fields.map(f => (
                        <td key={f.id} className="p-2.5 max-w-xs truncate">
                          {String(sub.answers[f.id] || '-')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Create Form Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" />
                创建班级征集表单
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateForm} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  表单标题 *
                </label>
                <input
                  type="text"
                  required
                  placeholder="例如：春季班级研学保险投保信息统计"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  表单说明与要求
                </label>
                <textarea
                  rows={2}
                  placeholder="说明填报目的、截止时间要求等..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  截止时间
                </label>
                <input
                  type="date"
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              {/* Fields List */}
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    字段填报项 ({fields.length})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddField}
                    className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    添加新字段
                  </button>
                </div>

                <div className="space-y-2">
                  {fields.map((f, idx) => (
                    <div key={f.id} className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={f.label}
                          onChange={(e) => {
                            const updated = [...fields];
                            updated[idx].label = e.target.value;
                            setFields(updated);
                          }}
                          placeholder="字段名称"
                          className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                        />
                        <select
                          value={f.type}
                          onChange={(e) => {
                            const updated = [...fields];
                            updated[idx].type = e.target.value as any;
                            setFields(updated);
                          }}
                          className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                        >
                          <option value="text">单行文本</option>
                          <option value="textarea">多行文本</option>
                          <option value="number">数字</option>
                          <option value="radio">单项选择</option>
                          <option value="file">文件上传</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => setFields(fields.filter((_, i) => i !== idx))}
                          className="text-slate-400 hover:text-rose-600 text-xs px-1"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs"
                >
                  {submitting ? '创建中...' : '确认发起表单'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
