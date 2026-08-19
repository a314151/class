import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit, 
  arrayUnion, 
  arrayRemove,
  addDoc,
  runTransaction,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { 
  UserProfile, 
  Notice, 
  ScheduleItem, 
  SchoolEvent, 
  ChatMessage, 
  DirectMessage, 
  BirthdayWish, 
  Poll, 
  FormCollection, 
  FormSubmission, 
  FeedbackItem, 
  ClassSettings, 
  UserRole
} from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
}

// ================= USER OPERATIONS =================
export const subscribeToUsers = (callback: (users: UserProfile[]) => void) => {
  const usersRef = collection(db, 'users');
  return onSnapshot(usersRef, (snapshot) => {
    const uniqueUsersMap = new Map<string, { profile: UserProfile; canonical: boolean }>();

    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as UserProfile;
      const profile = { ...data, uid: data.uid || docSnap.id };
      const isAdmin = profile.role === 'super_admin'
        || profile.studentId === '20260001'
        || profile.uid === 'admin_super_account'
        || profile.email?.toLowerCase() === 'lry674515314@gmail.com';
      const logicalKey = isAdmin
        ? 'admin_super_account'
        : profile.studentId?.trim() || profile.uid;
      const canonicalId = isAdmin ? 'admin_super_account' : profile.uid;
      const isCanonicalDocument = docSnap.id === canonicalId;
      const existing = uniqueUsersMap.get(logicalKey);

      if (!existing) {
        uniqueUsersMap.set(logicalKey, { profile, canonical: isCanonicalDocument });
        return;
      }

      const mergedProfile = isCanonicalDocument
        ? { ...existing.profile, ...profile }
        : { ...profile, ...existing.profile };
      uniqueUsersMap.set(logicalKey, {
        profile: mergedProfile,
        canonical: existing.canonical || isCanonicalDocument
      });
    });

    callback(Array.from(uniqueUsersMap.entries()).map(([key, entry]) => {
      if (key === 'admin_super_account') {
        return {
            ...entry.profile,
            uid: 'admin_super_account',
            role: 'super_admin',
            studentId: '20260001',
            name: entry.profile.name || '李班长 (超级管理员)',
            email: entry.profile.email || 'lry674515314@gmail.com'
          };
      }
      return entry.profile;
    }));
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'users');
  });
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const [userDoc, studentDoc] = await Promise.all([
      getDoc(doc(db, 'users', uid)),
      getDoc(doc(db, 'users', `student_${uid}`))
    ]);
    if (userDoc.exists()) {
      return userDoc.data() as UserProfile;
    }
    if (studentDoc.exists()) {
      return studentDoc.data() as UserProfile;
    }

    const qAuth = query(collection(db, 'users'), where('authUid', '==', uid));
    const qUid = query(collection(db, 'users'), where('uid', '==', uid));
    const [snapAuth, snapUid] = await Promise.all([
      getDocs(qAuth),
      getDocs(qUid)
    ]);
    if (!snapAuth.empty) {
      return snapAuth.docs[0].data() as UserProfile;
    }
    if (!snapUid.empty) {
      return snapUid.docs[0].data() as UserProfile;
    }
    return null;
  } catch (e) {
    handleFirestoreError(e, OperationType.GET, `users/${uid}`);
    return null;
  }
};

export const getUserProfileByStudentId = async (studentIdRaw: string): Promise<UserProfile | null> => {
  try {
    const studentId = studentIdRaw.trim();
    // 1. Direct doc check studentId or student_{studentId}
    const [rawDoc, directDoc] = await Promise.all([
      getDoc(doc(db, 'users', studentId)),
      getDoc(doc(db, 'users', `student_${studentId}`))
    ]);
    if (rawDoc.exists()) {
      return rawDoc.data() as UserProfile;
    }
    if (directDoc.exists()) {
      return directDoc.data() as UserProfile;
    }
    // 2. Query check
    const q = query(collection(db, 'users'), where('studentId', '==', studentId));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].data() as UserProfile;
    }
    return null;
  } catch (e) {
    handleFirestoreError(e, OperationType.GET, 'users');
    return null;
  }
};

export const getUserProfileByEmail = async (emailRaw: string): Promise<UserProfile | null> => {
  try {
    const rawEmail = emailRaw.trim();
    const normalizedEmail = rawEmail.toLowerCase();
    const emailQueries = [
      getDocs(query(collection(db, 'users'), where('email', '==', normalizedEmail)))
    ];
    if (rawEmail !== normalizedEmail) {
      emailQueries.push(getDocs(query(collection(db, 'users'), where('email', '==', rawEmail))));
    }

    const snapshots = await Promise.all(emailQueries);
    for (const snapshot of snapshots) {
      if (!snapshot.empty) {
        return snapshot.docs[0].data() as UserProfile;
      }
    }
    return null;
  } catch (e) {
    return null;
  }
};

export const saveUserProfile = async (profile: UserProfile): Promise<void> => {
  try {
    const normalizedProfile: UserProfile = {
      ...profile,
      uid: profile.uid.trim(),
      studentId: profile.studentId.trim(),
      email: profile.email.trim().toLowerCase()
    };
    await setDoc(doc(db, 'users', normalizedProfile.uid), normalizedProfile, { merge: true });
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `users/${profile.uid}`);
    throw e;
  }
};

export const deleteUserDoc = async (uid: string): Promise<void> => {
  try {
    const profile = await getUserProfile(uid);
    const documentIds = new Set([uid]);
    if (profile) {
      documentIds.add(profile.uid);
      const matchingQueries = [
        getDocs(query(collection(db, 'users'), where('uid', '==', profile.uid)))
      ];
      if (profile.studentId) {
        documentIds.add(profile.studentId);
        documentIds.add(`student_${profile.studentId}`);
        matchingQueries.push(
          getDocs(query(collection(db, 'users'), where('studentId', '==', profile.studentId)))
        );
      }

      const matchingSnapshots = await Promise.all(matchingQueries);
      matchingSnapshots.forEach((matches) => {
        matches.forEach((match) => documentIds.add(match.id));
      });
    }

    const batch = writeBatch(db);
    documentIds.forEach((documentId) => batch.delete(doc(db, 'users', documentId)));
    await batch.commit();
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `users/${uid}`);
    throw e;
  }
};

export const cleanupDuplicateUsers = async (): Promise<number> => {
  try {
    const snap = await getDocs(collection(db, 'users'));
    let cleanedCount = 0;
    const groups = new Map<string, Array<{ id: string; profile: UserProfile }>>();

    for (const docSnap of snap.docs) {
      const profile = docSnap.data() as UserProfile;
      const isAdmin = profile.role === 'super_admin'
        || profile.studentId === '20260001'
        || profile.email?.toLowerCase() === 'lry674515314@gmail.com'
        || docSnap.id === 'admin_super_account';
      const logicalKey = isAdmin
        ? 'admin_super_account'
        : `student:${profile.studentId?.trim() || profile.uid?.trim() || docSnap.id}`;
      const group = groups.get(logicalKey) || [];
      group.push({ id: docSnap.id, profile });
      groups.set(logicalKey, group);
    }

    let batch = writeBatch(db);
    let pendingWrites = 0;
    const flushBatch = async () => {
      if (pendingWrites === 0) return;
      await batch.commit();
      batch = writeBatch(db);
      pendingWrites = 0;
    };
    const ensureBatchCapacity = async () => {
      if (pendingWrites >= 450) {
        await flushBatch();
      }
    };

    for (const [logicalKey, entries] of groups) {
      const isAdmin = logicalKey === 'admin_super_account';
      const preferred = entries.find(({ id, profile }) => id === profile.uid) || entries[0];
      const canonicalId = isAdmin
        ? 'admin_super_account'
        : preferred.profile.uid?.trim() || preferred.profile.studentId?.trim() || preferred.id;
      const merged = entries.reduce<UserProfile>(
        (result, entry) => ({ ...result, ...entry.profile }),
        {} as UserProfile
      );
      Object.assign(merged, preferred.profile);
      const canonicalProfile: UserProfile = isAdmin
        ? {
            ...merged,
            uid: 'admin_super_account',
            role: 'super_admin',
            studentId: '20260001',
            email: 'lry674515314@gmail.com',
            name: merged.name || '李班长 (超级管理员)',
            bio: merged.bio || '班级空间超级管理员 / 班长'
          }
        : { ...merged, uid: canonicalId };

      await ensureBatchCapacity();
      batch.set(doc(db, 'users', canonicalId), canonicalProfile, { merge: false });
      pendingWrites++;

      for (const entry of entries) {
        if (entry.id === canonicalId) continue;
        await ensureBatchCapacity();
        batch.delete(doc(db, 'users', entry.id));
        pendingWrites++;
        cleanedCount++;
      }
    }

    await flushBatch();
    return cleanedCount;
  } catch (e) {
    console.warn('cleanupDuplicateUsers error:', e);
    return 0;
  }
};

export const updateUserRole = async (uid: string, newRole: UserRole): Promise<void> => {
  try {
    const profile = await getUserProfile(uid);
    if (!profile) {
      throw new Error(`User profile not found: ${uid}`);
    }
    await saveUserProfile({ ...profile, role: newRole });
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, `users/${uid}`);
    throw e;
  }
};

// ================= NOTICES =================
export const subscribeToNotices = (callback: (notices: Notice[]) => void) => {
  const q = query(collection(db, 'notices'));
  return onSnapshot(q, (snapshot) => {
    const notices: Notice[] = [];
    snapshot.forEach((d) => {
      notices.push({ id: d.id, ...d.data() } as Notice);
    });
    // Sort pinned first, then by date descending
    notices.sort((a, b) => {
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    callback(notices);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'notices');
  });
};

export const addNotice = async (notice: Omit<Notice, 'id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'notices'), notice);
    return docRef.id;
  } catch (e) {
    handleFirestoreError(e, OperationType.CREATE, 'notices');
    throw e;
  }
};

export const updateNotice = async (id: string, data: Partial<Notice>): Promise<void> => {
  try {
    await updateDoc(doc(db, 'notices', id), data);
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, `notices/${id}`);
    throw e;
  }
};

export const deleteNotice = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'notices', id));
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `notices/${id}`);
    throw e;
  }
};

export const markNoticeAsRead = async (noticeId: string, userUid: string): Promise<void> => {
  try {
    await updateDoc(doc(db, 'notices', noticeId), {
      readBy: arrayUnion(userUid)
    });
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, `notices/${noticeId}`);
  }
};

// ================= SCHEDULES =================
export const subscribeToSchedules = (callback: (schedules: ScheduleItem[]) => void) => {
  const colRef = collection(db, 'schedules');
  return onSnapshot(colRef, (snapshot) => {
    const list: ScheduleItem[] = [];
    snapshot.forEach((d) => {
      list.push({ id: d.id, ...d.data() } as ScheduleItem);
    });
    list.sort((a, b) => (a.dayOfWeek - b.dayOfWeek) || (a.period - b.period));
    callback(list);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'schedules');
  });
};

export const saveScheduleItem = async (item: Omit<ScheduleItem, 'id'> & { id?: string }): Promise<void> => {
  try {
    if (item.id) {
      const { id, ...rest } = item;
      await setDoc(doc(db, 'schedules', id), rest, { merge: true });
    } else {
      await addDoc(collection(db, 'schedules'), item);
    }
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, 'schedules');
    throw e;
  }
};

export const deleteScheduleItem = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'schedules', id));
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `schedules/${id}`);
    throw e;
  }
};

// ================= SCHOOL EVENTS / CALENDAR =================
export const subscribeToSchoolEvents = (callback: (events: SchoolEvent[]) => void) => {
  const colRef = collection(db, 'schoolEvents');
  return onSnapshot(colRef, (snapshot) => {
    const list: SchoolEvent[] = [];
    snapshot.forEach((d) => {
      list.push({ id: d.id, ...d.data() } as SchoolEvent);
    });
    list.sort((a, b) => a.date.localeCompare(b.date));
    callback(list);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'schoolEvents');
  });
};

export const addSchoolEvent = async (event: Omit<SchoolEvent, 'id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'schoolEvents'), event);
    return docRef.id;
  } catch (e) {
    handleFirestoreError(e, OperationType.CREATE, 'schoolEvents');
    throw e;
  }
};

export const deleteSchoolEvent = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'schoolEvents', id));
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `schoolEvents/${id}`);
    throw e;
  }
};

// ================= PUBLIC CHAT MESSAGES =================
export const subscribeToChatMessages = (callback: (messages: ChatMessage[]) => void) => {
  const q = query(collection(db, 'messages'), orderBy('createdAt', 'desc'), limit(150));
  return onSnapshot(q, (snapshot) => {
    const list: ChatMessage[] = [];
    snapshot.forEach((d) => {
      list.push({ id: d.id, ...d.data() } as ChatMessage);
    });
    callback(list.reverse());
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'messages');
  });
};

export const sendChatMessage = async (msg: Omit<ChatMessage, 'id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'messages'), msg);
    return docRef.id;
  } catch (e) {
    handleFirestoreError(e, OperationType.CREATE, 'messages');
    throw e;
  }
};

export const deleteChatMessage = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'messages', id));
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `messages/${id}`);
    throw e;
  }
};

export const togglePinMessage = async (id: string, isPinned: boolean): Promise<void> => {
  try {
    await updateDoc(doc(db, 'messages', id), { isPinned });
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, `messages/${id}`);
    throw e;
  }
};

// ================= DIRECT MESSAGES (私聊) =================
export const getConversationId = (uid1: string, uid2: string): string => {
  return [uid1, uid2].sort().join('_');
};

export const subscribeToDirectMessages = (
  conversationId: string, 
  callback: (messages: DirectMessage[]) => void
) => {
  const q = query(
    collection(db, 'directMessages'),
    where('conversationId', '==', conversationId),
    orderBy('createdAt', 'desc'),
    limit(100)
  );
  return onSnapshot(q, (snapshot) => {
    const list: DirectMessage[] = [];
    snapshot.forEach((d) => {
      list.push({ id: d.id, ...d.data() } as DirectMessage);
    });
    callback(list.reverse());
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, `directMessages?conversationId=${conversationId}`);
  });
};

export const sendDirectMessage = async (msg: Omit<DirectMessage, 'id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'directMessages'), msg);
    return docRef.id;
  } catch (e) {
    handleFirestoreError(e, OperationType.CREATE, 'directMessages');
    throw e;
  }
};

// ================= BIRTHDAY WISHES =================
export const subscribeToBirthdayWishes = (callback: (wishes: BirthdayWish[]) => void) => {
  const q = query(collection(db, 'birthdayWishes'), orderBy('createdAt', 'desc'), limit(100));
  return onSnapshot(q, (snapshot) => {
    const list: BirthdayWish[] = [];
    snapshot.forEach((d) => {
      list.push({ id: d.id, ...d.data() } as BirthdayWish);
    });
    callback(list);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'birthdayWishes');
  });
};

export const sendBirthdayWish = async (wish: Omit<BirthdayWish, 'id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'birthdayWishes'), wish);
    return docRef.id;
  } catch (e) {
    handleFirestoreError(e, OperationType.CREATE, 'birthdayWishes');
    throw e;
  }
};

export const toggleLikeWish = async (wishId: string, userUid: string, hasLiked: boolean): Promise<void> => {
  try {
    await updateDoc(doc(db, 'birthdayWishes', wishId), {
      likes: hasLiked ? arrayRemove(userUid) : arrayUnion(userUid)
    });
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, `birthdayWishes/${wishId}`);
    throw e;
  }
};

export const deleteBirthdayWish = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'birthdayWishes', id));
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `birthdayWishes/${id}`);
    throw e;
  }
};

// ================= POLLS (投票) =================
export const subscribeToPolls = (callback: (polls: Poll[]) => void) => {
  const q = query(collection(db, 'polls'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const list: Poll[] = [];
    snapshot.forEach((d) => {
      list.push({ id: d.id, ...d.data() } as Poll);
    });
    callback(list);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'polls');
  });
};

export const addPoll = async (poll: Omit<Poll, 'id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'polls'), poll);
    return docRef.id;
  } catch (e) {
    handleFirestoreError(e, OperationType.CREATE, 'polls');
    throw e;
  }
};

export const votePoll = async (
  pollId: string, 
  optionIds: string[], 
  userUid: string, 
  currentOptions: Poll['options'],
  _isMultiple: boolean
): Promise<void> => {
  try {
    const pollRef = doc(db, 'polls', pollId);
    await runTransaction(db, async (transaction) => {
      const pollSnapshot = await transaction.get(pollRef);
      if (!pollSnapshot.exists()) {
        throw new Error(`Poll not found: ${pollId}`);
      }

      const latestOptions = (pollSnapshot.data() as Poll).options || currentOptions;
      const updatedOptions = latestOptions.map((opt) => {
        const voterUids = opt.voterUids.filter((uid) => uid !== userUid);
        if (optionIds.includes(opt.id)) {
          voterUids.push(userUid);
        }
        return { ...opt, voterUids: Array.from(new Set(voterUids)) };
      });

      transaction.update(pollRef, { options: updatedOptions });
    });
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, `polls/${pollId}`);
    throw e;
  }
};

export const deletePoll = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'polls', id));
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `polls/${id}`);
    throw e;
  }
};

// ================= FORMS & SUBMISSIONS (表格征集) =================
export const subscribeToForms = (callback: (forms: FormCollection[]) => void) => {
  const q = query(collection(db, 'forms'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const list: FormCollection[] = [];
    snapshot.forEach((d) => {
      list.push({ id: d.id, ...d.data() } as FormCollection);
    });
    callback(list);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'forms');
  });
};

export const addForm = async (form: Omit<FormCollection, 'id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'forms'), {
      ...form,
      submissions: {}
    });
    return docRef.id;
  } catch (e) {
    handleFirestoreError(e, OperationType.CREATE, 'forms');
    throw e;
  }
};

export const submitFormResponse = async (
  formId: string, 
  submission: FormSubmission
): Promise<void> => {
  try {
    const formRef = doc(db, 'forms', formId);
    const key = `submissions.${submission.studentUid}`;
    await updateDoc(formRef, {
      [key]: submission
    });
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, `forms/${formId}`);
    throw e;
  }
};

export const deleteForm = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'forms', id));
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `forms/${id}`);
    throw e;
  }
};

// ================= FEEDBACK (意见反馈) =================
export const subscribeToFeedbacks = (callback: (feedbacks: FeedbackItem[]) => void) => {
  const q = query(collection(db, 'feedbacks'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const list: FeedbackItem[] = [];
    snapshot.forEach((d) => {
      list.push({ id: d.id, ...d.data() } as FeedbackItem);
    });
    callback(list);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'feedbacks');
  });
};

export const addFeedback = async (feedback: Omit<FeedbackItem, 'id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'feedbacks'), feedback);
    return docRef.id;
  } catch (e) {
    handleFirestoreError(e, OperationType.CREATE, 'feedbacks');
    throw e;
  }
};

export const updateFeedbackStatus = async (
  id: string, 
  status: FeedbackItem['status'], 
  reply?: string,
  replyAuthor?: string
): Promise<void> => {
  try {
    const updateData: any = { status };
    if (reply !== undefined) {
      updateData.reply = reply;
      updateData.replyAuthor = replyAuthor || '班委团队';
      updateData.repliedAt = new Date().toISOString();
    }
    await updateDoc(doc(db, 'feedbacks', id), updateData);
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, `feedbacks/${id}`);
    throw e;
  }
};

export const deleteFeedback = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'feedbacks', id));
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `feedbacks/${id}`);
    throw e;
  }
};

// ================= CLASS SETTINGS =================
export const subscribeToSettings = (callback: (settings: ClassSettings) => void) => {
  // First load from localStorage if available for zero-latency UI
  const cached = localStorage.getItem('class_space_cached_settings');
  if (cached) {
    try {
      callback(JSON.parse(cached));
    } catch (e) {}
  }

  return onSnapshot(doc(db, 'settings', 'general'), (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data() as ClassSettings;
      localStorage.setItem('class_space_cached_settings', JSON.stringify(data));
      callback(data);
    } else {
      const cached = localStorage.getItem('class_space_cached_settings');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          callback(parsed);
          return;
        } catch (e) {}
      }
      const defaultSettings: ClassSettings = {
        className: '高三 (1) 班 · 卓越空间',
        motto: '博学笃行，求是拓新，追光而行',
        semester: '2026年 春季学期',
        announcement: '欢迎来到班级空间！期中模拟考与研学报名正在进行中，请及时查看通知与提交表格。',
        cloudflareWorkerUrl: 'https://class-space-worker.pages.dev/api/upload',
        r2BucketName: 'class-space-assets'
      };
      localStorage.setItem('class_space_cached_settings', JSON.stringify(defaultSettings));
      callback(defaultSettings);
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'settings/general');
    const cached = localStorage.getItem('class_space_cached_settings');
    if (cached) {
      try {
        callback(JSON.parse(cached));
      } catch (e) {}
    }
  });
};

export const saveSettings = async (settings: Partial<ClassSettings>): Promise<void> => {
  try {
    const currentCached = localStorage.getItem('class_space_cached_settings');
    let merged = settings;
    if (currentCached) {
      try {
        merged = { ...JSON.parse(currentCached), ...settings };
      } catch (e) {}
    }
    localStorage.setItem('class_space_cached_settings', JSON.stringify(merged));
    await setDoc(doc(db, 'settings', 'general'), settings, { merge: true });
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, 'settings/general');
    throw e;
  }
};


// ================= SEED SAMPLE DATA =================
export const seedInitialClassData = async (adminUid: string, adminName: string) => {
  try {
    const flagDoc = await getDoc(doc(db, 'system', 'seed_flag'));
    if (flagDoc.exists()) return; // System already initialized once, NEVER re-seed deleted items!

    // Mark as initialized permanently
    await setDoc(doc(db, 'system', 'seed_flag'), {
      seeded: true,
      seededAt: new Date().toISOString()
    });

    // 1. Settings (only seed if not already configured)
    const settingsDoc = await getDoc(doc(db, 'settings', 'general'));
    if (!settingsDoc.exists()) {
      await setDoc(doc(db, 'settings', 'general'), {
        className: '高三 (1) 班 · 卓越空间',
        motto: '博学笃行，求是拓新，追光而行',
        semester: '2026年 春季学期',
        announcement: '🎉 欢迎来到我们班专属的智慧班级空间！通知、日程、表决、私聊与征集均已实时同步。',
        cloudflareWorkerUrl: 'https://class-files-worker.workers.dev/upload',
        r2BucketName: 'class-vault'
      });
    }

    // 2. Initial Notices
    const sampleNotices: Omit<Notice, 'id'>[] = [
      {
        title: '📢 关于本周五下午开展“百日誓师暨春季研学实践”的重要通知',
        content: '各位同学及班委：\n为增强班级凝聚力，学校定于本周五下午 14:30 在大礼堂举行誓师大会，随后前往科技馆进行研学实践。请同学们统一着正装校服，提前 10 分钟到场签到。\n\n注意事项：\n1. 班长与文娱委员负责各小组点名与秩序；\n2. 研学交通费用由班费统一支出；\n3. 请在“表格征集”模块填报是否需要统一订购班服纪念徽章。',
        category: 'urgent',
        isPinned: true,
        authorName: adminName || '超级管理员',
        authorUid: adminUid,
        readBy: [adminUid],
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString()
      },
      {
        title: '📚 第一次全真模拟统考科目时间表及考场分布安排',
        content: '下周一至周三将进行全省第一次模拟联考，具体时间：\n周一：09:00-11:30 语文 | 15:00-17:00 数学\n周二：09:00-11:30 综合科目 | 15:00-17:00 外语\n考场名单已张贴在教室后黑板，请同学们备齐 2B 铅笔与准考证。',
        category: 'exam',
        isPinned: false,
        authorName: '学习委员',
        authorUid: 'committee_sample',
        readBy: [adminUid],
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
      },
      {
        title: '🏀 班级春季三人篮球赛报名与抽签公示',
        content: '一年一度的年级春季篮球联赛报名开启！请有意向组队的同学联系体育委员，每队 4 人（含 1 名替补）。',
        category: 'activity',
        isPinned: false,
        authorName: '体育委员',
        authorUid: 'committee_sample',
        readBy: [],
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString()
      }
    ];
    for (const n of sampleNotices) {
      await addDoc(collection(db, 'notices'), n);
    }

    // 3. Weekly Schedules (Mon-Fri 8 periods)
    const weekSchedule: Omit<ScheduleItem, 'id'>[] = [
      // Monday
      { dayOfWeek: 1, period: 1, subject: '语文', teacher: '李老师', room: '教学楼 302', timeRange: '08:00 - 08:45' },
      { dayOfWeek: 1, period: 2, subject: '数学', teacher: '张老师', room: '教学楼 302', timeRange: '08:55 - 09:40' },
      { dayOfWeek: 1, period: 3, subject: '英语', teacher: 'Sarah', room: '语音室 101', timeRange: '10:00 - 10:45' },
      { dayOfWeek: 1, period: 4, subject: '物理', teacher: '赵老师', room: '实验室 A', timeRange: '10:55 - 11:40' },
      { dayOfWeek: 1, period: 5, subject: '化学', teacher: '陈老师', room: '教学楼 302', timeRange: '14:00 - 14:45' },
      { dayOfWeek: 1, period: 6, subject: '生物', teacher: '林老师', room: '教学楼 302', timeRange: '14:55 - 15:40' },
      { dayOfWeek: 1, period: 7, subject: '体育', teacher: '王教练', room: '田径场', timeRange: '16:00 - 16:45' },
      { dayOfWeek: 1, period: 8, subject: '晚自习/答疑', teacher: '各科轮值', room: '教学楼 302', timeRange: '19:00 - 21:00' },
      // Tuesday
      { dayOfWeek: 2, period: 1, subject: '数学', teacher: '张老师', room: '教学楼 302', timeRange: '08:00 - 08:45' },
      { dayOfWeek: 2, period: 2, subject: '语文', teacher: '李老师', room: '教学楼 302', timeRange: '08:55 - 09:40' },
      { dayOfWeek: 2, period: 3, subject: '物理', teacher: '赵老师', room: '教学楼 302', timeRange: '10:00 - 10:45' },
      { dayOfWeek: 2, period: 4, subject: '英语', teacher: 'Sarah', room: '教学楼 302', timeRange: '10:55 - 11:40' },
      { dayOfWeek: 2, period: 5, subject: '历史/政治', teacher: '周老师', room: '教学楼 302', timeRange: '14:00 - 14:45' },
      { dayOfWeek: 2, period: 6, subject: '地理', teacher: '孙老师', room: '地理专用教室', timeRange: '14:55 - 15:40' },
      { dayOfWeek: 2, period: 7, subject: '信息科技', teacher: '黄老师', room: '机房 401', timeRange: '16:00 - 16:45' },
      // Wednesday
      { dayOfWeek: 3, period: 1, subject: '英语', teacher: 'Sarah', room: '教学楼 302', timeRange: '08:00 - 08:45' },
      { dayOfWeek: 3, period: 2, subject: '数学', teacher: '张老师', room: '教学楼 302', timeRange: '08:55 - 09:40' },
      { dayOfWeek: 3, period: 3, subject: '语文', teacher: '李老师', room: '教学楼 302', timeRange: '10:00 - 10:45' },
      { dayOfWeek: 3, period: 4, subject: '化学', teacher: '陈老师', room: '化学实验室', timeRange: '10:55 - 11:40' },
      { dayOfWeek: 3, period: 5, subject: '物理', teacher: '赵老师', room: '教学楼 302', timeRange: '14:00 - 14:45' },
      { dayOfWeek: 3, period: 6, subject: '主题班会', teacher: '班主任', room: '教学楼 302', timeRange: '14:55 - 15:40' },
      { dayOfWeek: 3, period: 7, subject: '社团活动', teacher: '辅导员', room: '活动中心', timeRange: '16:00 - 16:45' },
      // Thursday
      { dayOfWeek: 4, period: 1, subject: '语文', teacher: '李老师', room: '教学楼 302', timeRange: '08:00 - 08:45' },
      { dayOfWeek: 4, period: 2, subject: '物理', teacher: '赵老师', room: '教学楼 302', timeRange: '08:55 - 09:40' },
      { dayOfWeek: 4, period: 3, subject: '数学', teacher: '张老师', room: '教学楼 302', timeRange: '10:00 - 10:45' },
      { dayOfWeek: 4, period: 4, subject: '英语', teacher: 'Sarah', room: '教学楼 302', timeRange: '10:55 - 11:40' },
      { dayOfWeek: 4, period: 5, subject: '生物', teacher: '林老师', room: '生物实验室', timeRange: '14:00 - 14:45' },
      { dayOfWeek: 4, period: 6, subject: '化学', teacher: '陈老师', room: '教学楼 302', timeRange: '14:55 - 15:40' },
      { dayOfWeek: 4, period: 7, subject: '音乐/美术', teacher: '艺术教研组', room: '艺术楼 201', timeRange: '16:00 - 16:45' },
      // Friday
      { dayOfWeek: 5, period: 1, subject: '数学', teacher: '张老师', room: '教学楼 302', timeRange: '08:00 - 08:45' },
      { dayOfWeek: 5, period: 2, subject: '英语', teacher: 'Sarah', room: '教学楼 302', timeRange: '08:55 - 09:40' },
      { dayOfWeek: 5, period: 3, subject: '语文', teacher: '李老师', room: '教学楼 302', timeRange: '10:00 - 10:45' },
      { dayOfWeek: 5, period: 4, subject: '物理', teacher: '赵老师', room: '教学楼 302', timeRange: '10:55 - 11:40' },
      { dayOfWeek: 5, period: 5, subject: '研学誓师', teacher: '年级组', room: '学校大礼堂', timeRange: '14:30 - 17:00' }
    ];
    for (const item of weekSchedule) {
      await addDoc(collection(db, 'schedules'), item);
    }

    // 4. School Events Calendar
    const schoolEvents: Omit<SchoolEvent, 'id'>[] = [
      {
        title: '🌸 开学典礼与收心班会',
        date: '2026-03-02',
        category: 'activity',
        description: '新学期启动仪式，颁发上学期优秀三好学生奖状。',
        location: '学校大操场'
      },
      {
        title: '🌱 植树节绿色校园志愿行动',
        date: '2026-03-12',
        category: 'activity',
        description: '班级认领后花园树苗，开展环保劳动。',
        location: '西区生态园'
      },
      {
        title: '📝 期中全校教学质量统一调研考',
        date: '2026-04-20',
        category: 'exam',
        description: '全科目期中测试，检验阶段学习成果。',
        location: '指定标准化考场'
      },
      {
        title: '🚩 五一国际劳动节放假',
        date: '2026-05-01',
        category: 'holiday',
        description: '全校放假 5 天，请同学们合理规划复习并注意安全出行。'
      },
      {
        title: '🏃 第42届校园春季田径运动会',
        date: '2026-05-18',
        category: 'activity',
        description: '为期两天的校运会，包含接力跑、跳高、铅球等项目。',
        location: '主田径场'
      },
      {
        title: '🎓 高考倒计时 30 天誓师大会',
        date: '2026-05-08',
        category: 'academic',
        description: '名师励志讲座与家长助威寄语。',
        location: '综合学术厅'
      }
    ];
    for (const ev of schoolEvents) {
      await addDoc(collection(db, 'schoolEvents'), ev);
    }

    // 5. Sample Poll
    await addDoc(collection(db, 'polls'), {
      title: '🗳️ 2026 春季研学班服定制主题投票',
      description: '请大家选出最心仪的研学定制纪念卫衣款式与颜色（支持多选）：',
      options: [
        { id: 'opt_1', text: '【极简藏青】刺绣班徽 + 纯棉连帽款', voterUids: [adminUid] },
        { id: 'opt_2', text: '【燕麦奶白】后背手绘全班合影漫画款', voterUids: [] },
        { id: 'opt_3', text: '【活力曜黑】反光条机能风工装拉链款', voterUids: [] },
        { id: 'opt_4', text: '【复古墨绿】学院风宽松棒球服款', voterUids: [] }
      ],
      isMultiple: true,
      isAnonymous: false,
      deadline: '2026-04-30',
      authorUid: adminUid,
      authorName: adminName || '超级管理员',
      createdAt: new Date().toISOString()
    });

    // 6. Sample Form Collection (表格征集)
    await addDoc(collection(db, 'forms'), {
      title: '📋 研学保险购买与紧急联系人信息统计表',
      description: '为保障每位同学在校外研学期间的安全，需统一购买意外保险，请如实填报。',
      fields: [
        { id: 'f_name', label: '学生真实姓名', type: 'text', required: true, placeholder: '例：陈小明' },
        { id: 'f_idcard', label: '身份证号码 / 证件号 (用于投保)', type: 'text', required: true, placeholder: '请输入18位身份证号' },
        { id: 'f_parent_phone', label: '家长/监护人紧急联系电话', type: 'text', required: true, placeholder: '请输入手机号' },
        { id: 'f_diet', label: '特殊饮食要求/过敏史', type: 'radio', options: ['无特殊禁忌', '清真饮食', '海鲜/坚果严重过敏', '其他（请注明）'], required: true },
        { id: 'f_notes', label: '补充说明 / 身体状况', type: 'textarea', required: false, placeholder: '如有晕车等情况可在此备注' }
      ],
      deadline: '2026-04-15',
      authorUid: adminUid,
      authorName: adminName || '超级管理员',
      createdAt: new Date().toISOString(),
      submissions: {
        [adminUid]: {
          studentUid: adminUid,
          studentName: adminName || '超级管理员',
          studentId: '20260101',
          submittedAt: new Date().toISOString(),
          answers: {
            f_name: adminName || '管理员',
            f_idcard: '11010120080101****',
            f_parent_phone: '13800000000',
            f_diet: '无特殊禁忌',
            f_notes: '一切正常，已准备好急救包。'
          }
        }
      }
    });

    // 7. Sample Birthday Wish
    await addDoc(collection(db, 'birthdayWishes'), {
      targetUid: adminUid,
      targetName: adminName || '班长',
      senderUid: 'student_chen',
      senderName: '陈同学',
      senderAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=chen',
      message: '祝班长生日快乐！感谢你平时辛勤为班级组织各项活动，愿你金榜题名，梦想成真！🎂🎉✨',
      createdAt: new Date().toISOString(),
      likes: [adminUid]
    });

    // 8. Sample Feedback
    await addDoc(collection(db, 'feedbacks'), {
      title: '💡 关于教室午休期间希望调暗前排日光灯的建议',
      content: '很多同学中午会在教室自习或小憩，前排日光灯直接照射比较刺眼，建议班委安排生活委员在 12:45 前后统一关闭前两排灯光。',
      category: 'life',
      isAnonymous: true,
      authorUid: 'anon_student_1',
      authorName: '匿名同学',
      status: 'resolved',
      reply: '已收到建议！班长已与生活委员沟通，即日起午休时间 12:30-13:40 开启柔光模式，感谢你的细心反馈！',
      replyAuthor: '班委团队',
      repliedAt: new Date().toISOString(),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString()
    });

    // 9. Sample Chat Message
    await addDoc(collection(db, 'messages'), {
      senderUid: adminUid,
      senderName: adminName || '超级管理员',
      senderAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=admin',
      senderRole: 'super_admin',
      content: '🌟 欢迎各位同学来到班级空间！左侧导航包含了日程、通知、校历、研学报名表、投票与实时聊天。大家可以在聊天室畅所欲言，也可以找班委私聊沟通问题~',
      createdAt: new Date().toISOString(),
      isPinned: true
    });

  } catch (err) {
    console.error('Failed to seed initial data:', err);
  }
};
