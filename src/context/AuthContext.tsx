import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isOwnerGoogleUser } from '../authConfig';
import type { UserProfile, UserRole } from '../types';
import { saveUserProfile } from '../services/firestoreService';
import {
  ApiError,
  apiRequest,
  postJson,
  type AuthSession,
  type SessionUser
} from '../services/apiClient';

interface ManagedMemberInput {
  studentId: string;
  name: string;
  email?: string;
  password: string;
  role: Exclude<UserRole, 'super_admin'>;
}

interface MemberRegistrationInput {
  studentId: string;
  name: string;
  email?: string;
  password: string;
}

interface AuthContextType {
  currentUser: SessionUser | null;
  profile: UserProfile | null;
  loading: boolean;
  accessError: string | null;
  isSuperAdmin: boolean;
  isCommittee: boolean;
  isMember: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithStudentIdOrEmail: (account: string, password: string) => Promise<void>;
  registerMember: (input: MemberRegistrationInput) => Promise<void>;
  createManagedMember: (input: ManagedMemberInput) => Promise<UserProfile>;
  updateMyProfile: (data: Partial<UserProfile>) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const clearLegacyAccessCaches = () => {
  localStorage.removeItem('class_space_cached_profile');
  localStorage.removeItem('class_space_admin_override');
  localStorage.removeItem('class_space_cached_settings');
  Object.keys(localStorage)
    .filter((key) => key.startsWith('class_space_registered_'))
    .forEach((key) => localStorage.removeItem(key));
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  const applySession = useCallback((session: AuthSession) => {
    setCurrentUser(session.user);
    setProfile(session.profile);
    setAccessError(null);
  }, []);

  useEffect(() => {
    let active = true;
    clearLegacyAccessCaches();

    const restoreSession = async () => {
      try {
        const session = await apiRequest<AuthSession>('/api/auth/session', {}, 12_000);
        if (active) applySession(session);
      } catch (error) {
        if (!active) return;
        setCurrentUser(null);
        setProfile(null);
        if (!(error instanceof ApiError) || error.status !== 401) {
          setAccessError(error instanceof Error ? error.message : '无法验证班级访问权限');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void restoreSession();
    return () => {
      active = false;
    };
  }, [applySession]);

  const loginWithStudentIdOrEmail = async (accountRaw: string, password: string) => {
    const studentId = accountRaw.trim().toLowerCase();
    if (!studentId || !password) throw new Error('请输入学号和密码');
    if (studentId.includes('@')) {
      throw new Error('成员请使用学号登录；管理员请使用下方 Google 登录');
    }
    const session = await postJson<AuthSession>('/api/auth/login', { studentId, password }, 20_000);
    applySession(session);
  };

  const registerMember = async (input: MemberRegistrationInput): Promise<void> => {
    const studentId = input.studentId.trim().toLowerCase();
    const name = input.name.trim();
    const email = input.email?.trim().toLowerCase() || '';
    if (!/^[a-z0-9_-]{2,32}$/.test(studentId)) {
      throw new Error('学号需为 2-32 位字母、数字、下划线或短横线');
    }
    if (!name || name.length > 40) throw new Error('请输入 1-40 个字的真实姓名');
    if (input.password.length < 8) throw new Error('密码至少需要 8 位');
    await postJson<{ registered: boolean }>('/api/auth/register', {
      studentId,
      name,
      email,
      password: input.password
    }, 20_000);
    setCurrentUser(null);
    setProfile(null);
    setAccessError(null);
  };

  const loginWithGoogle = async () => {
    // Ordinary phones never load this browser SDK; it is only needed for the owner login button.
    const firebase = await import('../firebase');
    const result = await firebase.signInWithPopup(firebase.auth, firebase.googleProvider);
    try {
      const idToken = await result.user.getIdToken();
      const session = await postJson<AuthSession>('/api/auth/firebase-session', {
        idToken,
        refreshToken: result.user.refreshToken
      }, 20_000);
      applySession(session);
    } finally {
      await firebase.signOut(firebase.auth).catch(() => undefined);
    }
  };

  const createManagedMember = async (input: ManagedMemberInput): Promise<UserProfile> => {
    if (!isOwnerGoogleUser(currentUser) || profile?.role !== 'super_admin') {
      throw new Error('只有已验证的超级管理员可以创建成员账号');
    }
    return postJson<UserProfile>('/api/auth/managed-user', {
      studentId: input.studentId,
      name: input.name,
      email: input.email || '',
      password: input.password,
      role: input.role
    }, 20_000);
  };

  const updateMyProfile = async (data: Partial<UserProfile>) => {
    if (!profile) throw new Error('当前未登录');
    const allowed: Partial<UserProfile> = {
      name: data.name,
      avatar: data.avatar,
      birthday: data.birthday,
      phone: data.phone,
      bio: data.bio
    };
    Object.keys(allowed).forEach((key) => {
      if (allowed[key as keyof UserProfile] === undefined) {
        delete allowed[key as keyof UserProfile];
      }
    });
    const updated = { ...profile, ...allowed };
    await saveUserProfile(updated);
    setProfile(updated);
  };

  const logout = async () => {
    try {
      await postJson<{ loggedOut: boolean }>('/api/auth/logout', {});
    } finally {
      clearLegacyAccessCaches();
      setCurrentUser(null);
      setProfile(null);
      setAccessError(null);
    }
  };

  const isSuperAdmin = isOwnerGoogleUser(currentUser) && profile?.role === 'super_admin';
  const value = useMemo<AuthContextType>(() => ({
    currentUser,
    profile,
    loading,
    accessError,
    isSuperAdmin,
    isCommittee: isSuperAdmin || profile?.role === 'committee',
    isMember: Boolean(currentUser && profile),
    loginWithGoogle,
    loginWithStudentIdOrEmail,
    registerMember,
    createManagedMember,
    updateMyProfile,
    logout
  }), [currentUser, profile, loading, accessError, isSuperAdmin]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export { getStudentAuthEmail } from '../authConfig';
