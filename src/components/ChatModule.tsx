import React, { useState, useEffect, useRef } from 'react';
import { 
  ChatMessage, 
  DirectMessage, 
  UserProfile, 
  UserRole 
} from '../types';
import { 
  subscribeToChatMessages, 
  sendChatMessage, 
  deleteChatMessage, 
  togglePinMessage, 
  subscribeToDirectMessages, 
  sendDirectMessage, 
  getConversationId, 
  subscribeToUsers 
} from '../services/firestoreService';
import { useAuth } from '../context/AuthContext';
import { R2UploadButton } from './R2UploadButton';
import { ConfirmModal } from './ConfirmModal';
import { 
  Send, 
  Users, 
  Pin, 
  Trash2, 
  MessageSquare, 
  Lock,
  ChevronDown,
  User
} from 'lucide-react';

const ROLE_BADGE: Record<UserRole, { label: string; style: string }> = {
  super_admin: { label: '管理员', style: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300' },
  committee: { label: '班委', style: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  member: { label: '同学', style: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' }
};

const readableSendError = (error: unknown): string => {
  const code = (error as { code?: string })?.code || '';
  if (code.endsWith('permission-denied')) return '消息发送失败：当前账号没有发送权限，请重新登录后再试';
  if (code.endsWith('unavailable')) return '消息发送失败：网络暂时不可用，请稍后重试';
  return '消息发送失败，请检查网络后重试';
};

const readableReceiveError = (error: unknown): string => {
  const code = (error as { code?: string })?.code || '';
  if (code.endsWith('permission-denied')) return '无法接收私聊：当前账号的私聊读取权限被拒绝，请联系管理员更新 Firestore 规则';
  if (code.endsWith('unavailable')) return '无法接收私聊：网络暂时不可用，请稍后重试';
  return '无法接收私聊，请刷新页面后重试';
};

const getMessagingUid = (user: UserProfile): string => (
  user.authUid?.trim() || user.uid.trim()
);

export const ChatModule: React.FC = () => {
  const { profile, isCommittee } = useAuth();
  const [chatMode, setChatMode] = useState<'public' | 'direct'>('public');
  const [showModeDropdown, setShowModeDropdown] = useState(false);

  // Public messages
  const [publicMessages, setPublicMessages] = useState<ChatMessage[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');

  // Direct messages
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedDmUser, setSelectedDmUser] = useState<UserProfile | null>(null);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [dmInput, setDmInput] = useState('');
  const [dmAttachment, setDmAttachment] = useState('');
  const [showDmUserDropdown, setShowDmUserDropdown] = useState(false);
  const [msgToDelete, setMsgToDelete] = useState<ChatMessage | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendingMode, setSendingMode] = useState<'public' | 'direct' | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const modeDropdownRef = useRef<HTMLDivElement>(null);
  const dmUserDropdownRef = useRef<HTMLDivElement>(null);
  const currentMessagingUid = profile ? getMessagingUid(profile) : null;
  const selectedDmUid = selectedDmUser ? getMessagingUid(selectedDmUser) : null;

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Subscribe to public messages
  useEffect(() => {
    const unsub = subscribeToChatMessages((data) => {
      setPublicMessages(data);
      setTimeout(scrollToBottom, 100);
    });
    return () => unsub();
  }, []);

  // Subscribe to all users
  useEffect(() => {
    const unsub = subscribeToUsers((data) => {
      setUsers(data);
      setSelectedDmUser((current) => {
        if (!profile) return null;
        const selfUid = getMessagingUid(profile);
        const currentUid = current ? getMessagingUid(current) : null;
        return (currentUid && data.find((user) => getMessagingUid(user) === currentUid && getMessagingUid(user) !== selfUid))
          || data.find((user) => getMessagingUid(user) !== selfUid)
          || null;
      });
    });
    return () => unsub();
  }, [profile]);

  // Subscribe to direct messages when DM partner changes
  useEffect(() => {
    if (chatMode !== 'direct' || !currentMessagingUid || !selectedDmUid) return;
    const convoId = getConversationId(currentMessagingUid, selectedDmUid);
    const unsub = subscribeToDirectMessages(
      convoId,
      currentMessagingUid,
      (data) => {
        setDirectMessages(data);
        setSendError(null);
        setTimeout(scrollToBottom, 100);
      },
      (error) => {
        setDirectMessages([]);
        setSendError(readableReceiveError(error));
      }
    );
    return () => unsub();
  }, [chatMode, currentMessagingUid, selectedDmUid]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modeDropdownRef.current && !modeDropdownRef.current.contains(event.target as Node)) {
        setShowModeDropdown(false);
      }
      if (dmUserDropdownRef.current && !dmUserDropdownRef.current.contains(event.target as Node)) {
        setShowDmUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Send public message
  const handleSendPublic = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputMsg.trim() && !attachmentUrl) || !profile || !currentMessagingUid) return;

    setSendError(null);
    setSendingMode('public');
    try {
      await sendChatMessage({
        senderUid: currentMessagingUid,
        senderName: profile.name,
        senderAvatar: profile.avatar,
        senderRole: profile.role,
        content: inputMsg.trim(),
        attachmentUrl: attachmentUrl || undefined,
        createdAt: new Date().toISOString()
      });
      setInputMsg('');
      setAttachmentUrl('');
    } catch (err) {
      console.error('Failed to send message:', err);
      setSendError(readableSendError(err));
    } finally {
      setSendingMode(null);
    }
  };

  // Send direct message
  const handleSendDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!dmInput.trim() && !dmAttachment) || !profile || !selectedDmUser || !currentMessagingUid || !selectedDmUid) return;

    setSendError(null);
    setSendingMode('direct');
    try {
      const convoId = getConversationId(currentMessagingUid, selectedDmUid);
      await sendDirectMessage({
        conversationId: convoId,
        senderUid: currentMessagingUid,
        recipientUid: selectedDmUid,
        senderName: profile.name,
        senderAvatar: profile.avatar,
        content: dmInput.trim(),
        attachmentUrl: dmAttachment || undefined,
        createdAt: new Date().toISOString(),
        isRead: false
      });
      setDmInput('');
      setDmAttachment('');
    } catch (err) {
      console.error('Failed to send DM:', err);
      setSendError(readableSendError(err));
    } finally {
      setSendingMode(null);
    }
  };

  const pinnedMessage = publicMessages.find(m => m.isPinned);

  return (
    <div className="space-y-4">
      {/* Header & Mode Switcher */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            班级交流大厅与同学私信
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            全班多人即时交流与同学一对一私聊
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Dropdown Selector */}
          <div className="relative" ref={modeDropdownRef}>
            <button
              type="button"
              onClick={() => setShowModeDropdown(!showModeDropdown)}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 rounded-xl transition-colors border border-slate-200/60 dark:border-slate-700/60"
            >
              {chatMode === 'public' ? (
                <>
                  <Users className="w-3.5 h-3.5 text-indigo-500" />
                  <span>班级大厅</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5 text-rose-500" />
                  <span>同学私信</span>
                </>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showModeDropdown && (
              <div className="absolute right-0 mt-1.5 w-36 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-1.5 text-xs z-30 animate-in fade-in space-y-0.5">
                <button
                  onClick={() => {
                    setChatMode('public');
                    setShowModeDropdown(false);
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                    chatMode === 'public'
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>班级大厅</span>
                </button>
                <button
                  onClick={() => {
                    setChatMode('direct');
                    setShowModeDropdown(false);
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                    chatMode === 'direct'
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>同学私信</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {sendError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
          {sendError}
        </div>
      )}

      {/* Main Chat Interface */}
      {chatMode === 'public' ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col h-[520px] overflow-hidden">
          {/* Pinned announcement header if exists */}
          {pinnedMessage && (
            <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/50 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 overflow-hidden">
                <Pin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="font-semibold text-amber-900 dark:text-amber-200 shrink-0">置顶：</span>
                <span className="text-amber-950 dark:text-amber-100 truncate">
                  {pinnedMessage.content}
                </span>
              </div>
              {isCommittee && (
                <button
                  onClick={() => togglePinMessage(pinnedMessage.id, false)}
                  className="text-[11px] text-amber-700 dark:text-amber-400 hover:underline shrink-0 ml-2 font-medium"
                >
                  取消置顶
                </button>
              )}
            </div>
          )}

          {/* Messages Stream */}
          <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-3.5 scrollbar-none">
            {publicMessages.length === 0 ? (
              <div className="text-center py-20 text-slate-400 text-xs">
                班级大厅空空如也，发一条消息打个招呼吧！👋
              </div>
            ) : (
              publicMessages.map((msg) => {
                const isMe = currentMessagingUid === msg.senderUid;
                const roleInfo = ROLE_BADGE[msg.senderRole] || ROLE_BADGE.member;

                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}
                  >
                    <img
                      src={msg.senderAvatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=avatar'}
                      alt={msg.senderName}
                      className="w-7 h-7 rounded-full bg-slate-100 shrink-0 border border-slate-200 object-cover"
                    />

                    <div className={`max-w-[80%] space-y-1 ${isMe ? 'items-end text-right' : ''}`}>
                      <div className={`flex items-center gap-1.5 text-[11px] ${isMe ? 'justify-end' : ''}`}>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {msg.senderName}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-sm ${roleInfo.style}`}>
                          {roleInfo.label}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(msg.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div
                        className={`p-3 rounded-2xl text-xs leading-relaxed inline-block text-left break-words ${
                          isMe
                            ? 'bg-indigo-600 text-white rounded-tr-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-xs'
                        }`}
                      >
                        {msg.content}

                        {/* Image attachment */}
                        {msg.attachmentUrl && (
                          <div className="mt-2 pt-2 border-t border-white/20">
                            <img
                              src={msg.attachmentUrl}
                              alt="Attachment"
                              className="max-w-xs max-h-44 rounded-xl object-cover cursor-pointer hover:opacity-95 transition-opacity"
                              onClick={() => window.open(msg.attachmentUrl, '_blank', 'noopener,noreferrer')}
                            />
                          </div>
                        )}
                      </div>

                      {/* Committee message controls */}
                      {isCommittee && (
                        <div className={`flex items-center gap-2 text-[10px] text-slate-400 ${isMe ? 'justify-end' : ''}`}>
                          <button
                            onClick={() => togglePinMessage(msg.id, !msg.isPinned)}
                            className="hover:text-amber-600 flex items-center gap-0.5"
                          >
                            <Pin className="w-3 h-3" />
                            {msg.isPinned ? '取消置顶' : '置顶'}
                          </button>
                          <button
                            onClick={() => setMsgToDelete(msg)}
                            className="hover:text-rose-600 flex items-center gap-0.5"
                          >
                            <Trash2 className="w-3 h-3" />
                            删除
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <form onSubmit={handleSendPublic} className="p-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 space-y-2">
            {attachmentUrl && (
              <div className="flex items-center justify-between p-2 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-xs text-indigo-900 dark:text-indigo-200">
                <span className="truncate">已选择图片附件</span>
                <button type="button" onClick={() => setAttachmentUrl('')} className="text-rose-600 hover:underline text-[11px]">
                  移除
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <R2UploadButton
                onUploaded={(url) => setAttachmentUrl(url)}
                buttonText="图片"
                accept="image/*"
              />

              <input
                type="text"
                placeholder={profile ? "说点什么吧，按回车发送..." : "请先登录后参与发言"}
                disabled={!profile}
                value={inputMsg}
                onChange={(e) => setInputMsg(e.target.value)}
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />

              <button
                type="submit"
                disabled={!profile || sendingMode !== null || (!inputMsg.trim() && !attachmentUrl)}
                className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl shadow-xs transition-colors"
                aria-label={sendingMode === 'public' ? '正在发送消息' : '发送消息'}
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Direct Messages Mode (私聊) */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col md:grid md:grid-cols-12 h-[520px] overflow-hidden">
          {/* Classmate Selector for Mobile (Dropdown) / Desktop (Sidebar) */}
          <div className="hidden md:flex md:col-span-4 border-r border-slate-100 dark:border-slate-800 flex-col h-full bg-slate-50/50 dark:bg-slate-900/50">
            <div className="p-3 border-b border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">
              全班同学 ({users.length})
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 scrollbar-none">
              {users.filter((user) => getMessagingUid(user) !== currentMessagingUid).map((user) => {
                const userMessagingUid = getMessagingUid(user);
                const isSelected = selectedDmUid === userMessagingUid;
                return (
                  <button
                    key={userMessagingUid}
                    onClick={() => setSelectedDmUser(user)}
                    className={`w-full p-2.5 flex items-center gap-2.5 text-left transition-colors ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 border-l-2 border-indigo-600'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-7 h-7 rounded-full bg-slate-100 shrink-0 border border-slate-200 object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {user.name}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {user.role === 'super_admin' ? '超管' : user.role === 'committee' ? '班委' : '同学'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">
                        {user.studentId ? `学号: ${user.studentId}` : '同学'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Direct Conversation Window */}
          <div className="flex-1 md:col-span-8 flex flex-col h-full">
            {/* Top Bar with Mobile User Selector Dropdown */}
            <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
              {selectedDmUser ? (
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <img
                      src={selectedDmUser.avatar}
                      alt={selectedDmUser.name}
                      className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 object-cover"
                    />
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        {selectedDmUser.name}
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        一对一私聊
                      </p>
                    </div>
                  </div>

                  {/* Mobile Select dropdown */}
                  <div className="relative md:hidden" ref={dmUserDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setShowDmUserDropdown(!showDmUserDropdown)}
                      className="px-2.5 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center gap-1 text-slate-700 dark:text-slate-300"
                    >
                      <span>换同学</span>
                      <ChevronDown className="w-3 h-3" />
                    </button>

                    {showDmUserDropdown && (
                      <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-1 z-30 max-h-52 overflow-y-auto">
                        {users.filter((user) => getMessagingUid(user) !== currentMessagingUid).map((user) => (
                          <button
                            key={getMessagingUid(user)}
                            onClick={() => {
                              setSelectedDmUser(user);
                              setShowDmUserDropdown(false);
                            }}
                            className="w-full px-2 py-1.5 text-xs text-left rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 truncate"
                          >
                            {user.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <span className="text-xs text-slate-400">请选择一位同学开始私聊</span>
              )}
            </div>

            {/* DM Message stream */}
            <div className="flex-1 p-3.5 sm:p-4 overflow-y-auto space-y-3 scrollbar-none">
              {directMessages.length === 0 ? (
                <div className="text-center py-20 text-slate-400 text-xs">
                  开始与 @{selectedDmUser?.name} 发送第一条私信吧！💬
                </div>
              ) : (
                directMessages.map((dm) => {
                  const isMe = currentMessagingUid === dm.senderUid;
                  return (
                    <div
                      key={dm.id}
                      className={`flex items-start gap-2 ${isMe ? 'flex-row-reverse' : ''}`}
                    >
                      <img
                        src={dm.senderAvatar}
                        alt={dm.senderName}
                        className="w-6 h-6 rounded-full bg-slate-100 shrink-0 border border-slate-200 object-cover"
                      />
                      <div className={`max-w-[75%] space-y-1 ${isMe ? 'items-end text-right' : ''}`}>
                        <div
                          className={`p-2.5 rounded-2xl text-xs leading-relaxed inline-block text-left break-words ${
                            isMe
                              ? 'bg-indigo-600 text-white rounded-tr-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-xs'
                          }`}
                        >
                          {dm.content}
                          {dm.attachmentUrl && (
                            <img
                              src={dm.attachmentUrl}
                              alt="Attachment"
                              className="mt-1.5 rounded-xl max-h-36 cursor-pointer"
                              onClick={() => window.open(dm.attachmentUrl, '_blank', 'noopener,noreferrer')}
                            />
                          )}
                        </div>
                        <div className="text-[9px] text-slate-400">
                          {new Date(dm.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* DM Input Bar */}
            <form onSubmit={handleSendDirect} className="p-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <R2UploadButton
                onUploaded={(url) => setDmAttachment(url)}
                buttonText="图片"
                accept="image/*"
              />
              <input
                type="text"
                placeholder={selectedDmUser ? `给 @${selectedDmUser.name} 发私聊...` : "请先选择私聊对象"}
                disabled={!selectedDmUser}
                value={dmInput}
                onChange={(e) => setDmInput(e.target.value)}
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={sendingMode !== null || (!dmInput.trim() && !dmAttachment)}
                className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl shadow-xs transition-colors"
                aria-label={sendingMode === 'direct' ? '正在发送私信' : '发送私信'}
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Message Modal */}
      <ConfirmModal
        isOpen={Boolean(msgToDelete)}
        title="确认撤回/删除该条发言？"
        message={`确定要删除 ${msgToDelete?.senderName} 发送的这条消息吗？`}
        confirmText="确认删除"
        onConfirm={async () => {
          if (msgToDelete) {
            await deleteChatMessage(msgToDelete.id);
          }
        }}
        onClose={() => setMsgToDelete(null)}
      />
    </div>
  );
};
