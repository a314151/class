import type {
  BirthdayWish,
  ChatMessage,
  ClassSettings,
  DirectMessage,
  FeedbackItem,
  FormCollection,
  FormSubmission,
  Notice,
  Poll,
  ScheduleItem,
  SchoolEvent,
  UserProfile,
  UserRole
} from '../types';
import { postJson } from './apiClient';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write'
}

interface QueryFilter {
  field: string;
  op: '==' | 'array-contains';
  value: unknown;
}

interface QueryOrder {
  field: string;
  direction: 'asc' | 'desc';
}

interface FirestoreRequest {
  action: 'get' | 'list' | 'add' | 'set' | 'update' | 'delete' | 'transform';
  collection: string;
  id?: string;
  data?: Record<string, unknown>;
  merge?: boolean;
  filters?: QueryFilter[];
  orderBy?: QueryOrder[];
  limit?: number;
  transforms?: Array<{
    field: string;
    operation: 'arrayUnion' | 'arrayRemove';
    values: unknown[];
  }>;
}

const firestoreRequest = <T>(body: FirestoreRequest) =>
  postJson<T>('/api/firestore', body as unknown as Record<string, unknown>, 20_000);

const getDocument = <T>(collection: string, id: string) =>
  firestoreRequest<(T & { id: string }) | null>({ action: 'get', collection, id });

const listDocuments = <T>(
  collection: string,
  options: { filters?: QueryFilter[]; orderBy?: QueryOrder[]; limit?: number } = {}
) => firestoreRequest<Array<T & { id: string }>>({ action: 'list', collection, ...options });

const addDocument = async <T extends object>(collection: string, data: T): Promise<string> => {
  const result = await firestoreRequest<{ id: string }>({
    action: 'add',
    collection,
    data: omitUndefinedFields(data) as Record<string, unknown>
  });
  return result.id;
};

const setDocument = <T extends object>(collection: string, id: string, data: T, merge = true) =>
  firestoreRequest<Record<string, unknown>>({
    action: merge ? 'update' : 'set',
    collection,
    id,
    data: omitUndefinedFields(data) as Record<string, unknown>,
    merge
  });

const deleteDocument = (collection: string, id: string) =>
  firestoreRequest<{ deleted: boolean }>({ action: 'delete', collection, id });

const transformArray = (
  collection: string,
  id: string,
  field: string,
  operation: 'arrayUnion' | 'arrayRemove',
  values: unknown[]
) => firestoreRequest<{ updated: boolean }>({
  action: 'transform',
  collection,
  id,
  transforms: [{ field, operation, values }]
});

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path
  };
  console.error('Class API Error:', JSON.stringify(errInfo));
}

const omitUndefinedFields = <T extends object>(value: T): T => (
  Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined)
  ) as T
);

const subscribeByPolling = <T>(
  loader: () => Promise<T>,
  callback: (value: T) => void,
  options: { intervalMs?: number; path: string; onError?: (error: unknown) => void }
) => {
  let cancelled = false;
  let timerId: number | undefined;
  let inFlight = false;
  const intervalMs = options.intervalMs || 6_000;

  const schedule = () => {
    if (cancelled) return;
    timerId = window.setTimeout(run, intervalMs);
  };

  const run = async () => {
    if (cancelled || inFlight) return;
    if (document.visibilityState === 'hidden') {
      schedule();
      return;
    }
    inFlight = true;
    try {
      const value = await loader();
      if (!cancelled) callback(value);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, options.path);
      if (!cancelled) options.onError?.(error);
    } finally {
      inFlight = false;
      schedule();
    }
  };

  const handleVisibility = () => {
    if (document.visibilityState !== 'visible' || cancelled) return;
    if (timerId !== undefined) window.clearTimeout(timerId);
    void run();
  };
  document.addEventListener('visibilitychange', handleVisibility);
  void run();

  return () => {
    cancelled = true;
    if (timerId !== undefined) window.clearTimeout(timerId);
    document.removeEventListener('visibilitychange', handleVisibility);
  };
};

const normalizeUsers = (documents: Array<UserProfile & { id: string }>): UserProfile[] => {
  const uniqueUsersMap = new Map<string, { profile: UserProfile; canonical: boolean }>();
  documents.forEach((document) => {
    const { id: documentId, ...data } = document;
    const profile: UserProfile = {
      ...data,
      uid: data.uid || documentId,
      profileDocId: documentId
    };
    const logicalKey = profile.studentId?.trim() || profile.authUid || profile.uid;
    const isCanonical = Boolean(profile.authUid) && documentId === profile.authUid;
    const existing = uniqueUsersMap.get(logicalKey);
    if (!existing) {
      uniqueUsersMap.set(logicalKey, { profile, canonical: isCanonical });
      return;
    }
    uniqueUsersMap.set(logicalKey, {
      profile: isCanonical
        ? { ...existing.profile, ...profile }
        : { ...profile, ...existing.profile },
      canonical: existing.canonical || isCanonical
    });
  });
  return Array.from(uniqueUsersMap.values()).map((entry) => entry.profile);
};

export const subscribeToUsers = (callback: (users: UserProfile[]) => void) =>
  subscribeByPolling(
    async () => normalizeUsers(await listDocuments<UserProfile>('users')),
    callback,
    { path: 'users', intervalMs: 10_000 }
  );

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const direct = await getDocument<UserProfile>('users', uid);
    if (direct) return { ...direct, uid: direct.uid || direct.id };
    const matches = await listDocuments<UserProfile>('users', {
      filters: [{ field: 'authUid', op: '==', value: uid }],
      limit: 1
    });
    return matches[0] ? { ...matches[0], uid: matches[0].uid || matches[0].id } : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${uid}`);
    return null;
  }
};

export const getUserProfileByStudentId = async (studentIdRaw: string): Promise<UserProfile | null> => {
  const studentId = studentIdRaw.trim();
  try {
    const [raw, prefixed] = await Promise.all([
      getDocument<UserProfile>('users', studentId),
      getDocument<UserProfile>('users', `student_${studentId}`)
    ]);
    if (raw) return raw;
    if (prefixed) return prefixed;
    const matches = await listDocuments<UserProfile>('users', {
      filters: [{ field: 'studentId', op: '==', value: studentId }],
      limit: 1
    });
    return matches[0] || null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'users');
    return null;
  }
};

export const getUserProfileByEmail = async (emailRaw: string): Promise<UserProfile | null> => {
  try {
    const matches = await listDocuments<UserProfile>('users', {
      filters: [{ field: 'email', op: '==', value: emailRaw.trim().toLowerCase() }],
      limit: 1
    });
    return matches[0] || null;
  } catch {
    return null;
  }
};

export const saveUserProfile = async (profile: UserProfile): Promise<void> => {
  const {
    profileDocId: _profileDocId,
    passwordHash: _passwordHash,
    id: _id,
    ...safeProfile
  } = profile as UserProfile & { id?: string };
  const normalized = {
    ...safeProfile,
    uid: profile.uid.trim(),
    studentId: profile.studentId.trim(),
    email: profile.email.trim().toLowerCase()
  };
  await setDocument('users', normalized.uid, normalized, true);
};

export const deleteUserDoc = async (uid: string): Promise<void> => {
  const profile = await getUserProfile(uid);
  const ids = new Set([uid]);
  if (profile) {
    ids.add(profile.uid);
    if (profile.profileDocId) ids.add(profile.profileDocId);
    if (profile.studentId) {
      ids.add(profile.studentId);
      ids.add(`student_${profile.studentId}`);
      const matches = await listDocuments<UserProfile>('users', {
        filters: [{ field: 'studentId', op: '==', value: profile.studentId }]
      });
      matches.forEach((match) => ids.add(match.id));
    }
  }
  await Promise.all(Array.from(ids).map((id) => deleteDocument('users', id)));
};

export const cleanupDuplicateUsers = async (): Promise<number> => {
  try {
    const documents = await listDocuments<UserProfile>('users');
    const groups = new Map<string, Array<UserProfile & { id: string }>>();
    documents.forEach((document) => {
      const isAdmin = document.role === 'super_admin'
        || document.studentId === '20260001'
        || document.email?.toLowerCase() === 'lry674515314@gmail.com';
      const key = isAdmin
        ? 'admin'
        : `student:${document.studentId?.trim() || document.uid?.trim() || document.id}`;
      groups.set(key, [...(groups.get(key) || []), document]);
    });
    let cleaned = 0;
    for (const [key, entries] of groups) {
      if (entries.length < 2) continue;
      const preferred = entries.find((entry) => entry.id === entry.authUid)
        || entries.find((entry) => entry.id === entry.uid)
        || entries[0];
      const canonicalId = preferred.authUid || preferred.uid || preferred.id;
      const merged = entries.reduce<UserProfile>((value, entry) => ({ ...value, ...entry }), {} as UserProfile);
      const { id: _id, profileDocId: _docId, ...safeMerged } = { ...merged, ...preferred };
      await setDocument('users', canonicalId, {
        ...safeMerged,
        uid: canonicalId,
        ...(key === 'admin' ? { role: 'super_admin', studentId: '20260001' } : {})
      }, false);
      for (const entry of entries) {
        if (entry.id === canonicalId) continue;
        await deleteDocument('users', entry.id);
        cleaned += 1;
      }
    }
    return cleaned;
  } catch (error) {
    console.warn('cleanupDuplicateUsers error:', error);
    return 0;
  }
};

export const updateUserRole = async (uid: string, role: UserRole): Promise<void> => {
  await setDocument('users', uid, { role }, true);
};

export const subscribeToNotices = (callback: (notices: Notice[]) => void) =>
  subscribeByPolling(
    async () => {
      const notices = await listDocuments<Notice>('notices');
      return notices.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    },
    callback,
    { path: 'notices' }
  );

export const addNotice = (notice: Omit<Notice, 'id'>) => addDocument('notices', notice);
export const updateNotice = async (id: string, data: Partial<Notice>) => { await setDocument('notices', id, data, true); };
export const deleteNotice = async (id: string) => { await deleteDocument('notices', id); };
export const markNoticeAsRead = async (noticeId: string, userUid: string) => {
  await transformArray('notices', noticeId, 'readBy', 'arrayUnion', [userUid]);
};

export const subscribeToSchedules = (callback: (items: ScheduleItem[]) => void) =>
  subscribeByPolling(
    async () => (await listDocuments<ScheduleItem>('schedules'))
      .sort((a, b) => (a.dayOfWeek - b.dayOfWeek) || (a.period - b.period)),
    callback,
    { path: 'schedules', intervalMs: 12_000 }
  );

export const saveScheduleItem = async (item: Omit<ScheduleItem, 'id'> & { id?: string }) => {
  const { id, ...data } = item;
  if (id) await setDocument('schedules', id, data, true);
  else await addDocument('schedules', data);
};
export const deleteScheduleItem = async (id: string) => { await deleteDocument('schedules', id); };

export const subscribeToSchoolEvents = (callback: (events: SchoolEvent[]) => void) =>
  subscribeByPolling(
    async () => (await listDocuments<SchoolEvent>('schoolEvents')).sort((a, b) => a.date.localeCompare(b.date)),
    callback,
    { path: 'schoolEvents', intervalMs: 12_000 }
  );

export const addSchoolEvent = (event: Omit<SchoolEvent, 'id'>) => addDocument('schoolEvents', event);
export const deleteSchoolEvent = async (id: string) => { await deleteDocument('schoolEvents', id); };

export const subscribeToChatMessages = (callback: (messages: ChatMessage[]) => void) =>
  subscribeByPolling(
    async () => {
      const messages = await listDocuments<ChatMessage>('messages', {
        orderBy: [{ field: 'createdAt', direction: 'desc' }],
        limit: 150
      });
      return messages.reverse();
    },
    callback,
    { path: 'messages', intervalMs: 3_000 }
  );

export const sendChatMessage = (message: Omit<ChatMessage, 'id'>) => addDocument('messages', message);
export const deleteChatMessage = async (id: string) => { await deleteDocument('messages', id); };
export const togglePinMessage = async (id: string, isPinned: boolean) => {
  await setDocument('messages', id, { isPinned }, true);
};

export const getConversationId = (uid1: string, uid2: string): string => [uid1, uid2].sort().join('_');

export const subscribeToDirectMessages = (
  conversationId: string,
  currentUid: string,
  callback: (messages: DirectMessage[]) => void,
  onError?: (error: unknown) => void
) => subscribeByPolling(
  async () => {
    const messages = await listDocuments<DirectMessage>('directMessages', {
      filters: [{ field: 'participantUids', op: 'array-contains', value: currentUid }],
      limit: 100
    });
    return messages
      .filter((message) => message.conversationId === conversationId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(-100);
  },
  callback,
  { path: `directMessages?conversationId=${conversationId}`, intervalMs: 3_000, onError }
);

export const sendDirectMessage = (message: Omit<DirectMessage, 'id'>) =>
  addDocument('directMessages', {
    ...message,
    participantUids: Array.from(new Set([message.senderUid, message.recipientUid]))
  });

export const subscribeToBirthdayWishes = (callback: (wishes: BirthdayWish[]) => void) =>
  subscribeByPolling(
    () => listDocuments<BirthdayWish>('birthdayWishes', {
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
      limit: 100
    }),
    callback,
    { path: 'birthdayWishes' }
  );

export const sendBirthdayWish = (wish: Omit<BirthdayWish, 'id'>) => addDocument('birthdayWishes', wish);
export const updateBirthdayWish = async (id: string, message: string) => {
  await setDocument('birthdayWishes', id, { message, updatedAt: new Date().toISOString() }, true);
};
export const toggleLikeWish = async (id: string, uid: string, hasLiked: boolean) => {
  await transformArray('birthdayWishes', id, 'likes', hasLiked ? 'arrayRemove' : 'arrayUnion', [uid]);
};
export const deleteBirthdayWish = async (id: string) => { await deleteDocument('birthdayWishes', id); };

export const setUserAccessDisabled = async (uid: string, disabled: boolean) => {
  await setDocument('users', uid, { disabled }, true);
};
export const approveUserAccess = async (uid: string) => {
  await setDocument('users', uid, { approved: true, disabled: false }, true);
};

export const subscribeToAdminDirectMessages = (callback: (messages: DirectMessage[]) => void) =>
  subscribeByPolling(
    () => listDocuments<DirectMessage>('directMessages', {
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
      limit: 200
    }),
    callback,
    { path: 'directMessages/admin-debug', intervalMs: 5_000 }
  );

export const subscribeToPolls = (callback: (polls: Poll[]) => void) =>
  subscribeByPolling(
    () => listDocuments<Poll>('polls', { orderBy: [{ field: 'createdAt', direction: 'desc' }] }),
    callback,
    { path: 'polls' }
  );
export const addPoll = (poll: Omit<Poll, 'id'>) => addDocument('polls', poll);
export const votePoll = async (
  pollId: string,
  optionIds: string[],
  _userUid: string,
  _currentOptions: Poll['options'],
  _isMultiple: boolean
) => {
  await postJson<{ updated: boolean }>('/api/polls/vote', { pollId, optionIds }, 20_000);
};
export const deletePoll = async (id: string) => { await deleteDocument('polls', id); };

export const subscribeToForms = (callback: (forms: FormCollection[]) => void) =>
  subscribeByPolling(
    () => listDocuments<FormCollection>('forms', { orderBy: [{ field: 'createdAt', direction: 'desc' }] }),
    callback,
    { path: 'forms' }
  );
export const addForm = (form: Omit<FormCollection, 'id'>) => addDocument('forms', { ...form, submissions: {} });
export const submitFormResponse = async (formId: string, submission: FormSubmission) => {
  await setDocument('forms', formId, { [`submissions.${submission.studentUid}`]: submission }, true);
};
export const deleteForm = async (id: string) => { await deleteDocument('forms', id); };

export const subscribeToFeedbacks = (callback: (items: FeedbackItem[]) => void) =>
  subscribeByPolling(
    () => listDocuments<FeedbackItem>('feedbacks', { orderBy: [{ field: 'createdAt', direction: 'desc' }] }),
    callback,
    { path: 'feedbacks' }
  );
export const addFeedback = (feedback: Omit<FeedbackItem, 'id'>) => addDocument('feedbacks', feedback);
export const updateFeedbackStatus = async (
  id: string,
  status: FeedbackItem['status'],
  reply?: string,
  replyAuthor?: string
) => {
  const data: Partial<FeedbackItem> = { status };
  if (reply !== undefined) {
    data.reply = reply;
    data.replyAuthor = replyAuthor || '班委团队';
    data.repliedAt = new Date().toISOString();
  }
  await setDocument('feedbacks', id, data, true);
};
export const deleteFeedback = async (id: string) => { await deleteDocument('feedbacks', id); };

const defaultSettings: ClassSettings = {
  className: '班级空间',
  motto: '',
  semester: '',
  announcement: ''
};

export const subscribeToSettings = (callback: (settings: ClassSettings) => void) =>
  subscribeByPolling(
    async () => (await getDocument<ClassSettings>('settings', 'general')) || defaultSettings,
    callback,
    { path: 'settings/general', intervalMs: 15_000 }
  );
export const saveSettings = async (settings: Partial<ClassSettings>) => {
  await setDocument('settings', 'general', settings, true);
};

export const seedInitialClassData = async (_adminUid: string, _adminName: string) => {
  try {
    const flag = await getDocument<{ seeded: boolean }>('system', 'seed_flag');
    if (flag) return;
    await setDocument('system', 'seed_flag', {
      seeded: true,
      seededAt: new Date().toISOString()
    }, false);
    const settings = await getDocument<ClassSettings>('settings', 'general');
    if (!settings) await setDocument('settings', 'general', defaultSettings, false);
  } catch (error) {
    console.error('Failed to initialize class data:', error);
  }
};
