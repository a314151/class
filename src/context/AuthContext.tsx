import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  auth,
  createManagedAuthUser,
  googleProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from '../firebase';
import { getStudentAuthEmail, isOwnerGoogleUser, OWNER_EMAIL } from '../authConfig';
import type { UserProfile, UserRole } from '../types';
import { getUserProfile, saveUserProfile } from '../services/firestoreService';

interface ManagedMemberInput {
  studentId: string;
  name: string;
  email?: string;
  password: string;
  role: Exclude<UserRole, 'super_admin'>;
}

interface AuthContextType {
  currentUser: User | null;
  profile: UserProfile | null;
  loading: boolean;
  accessError: string | null;
  isSuperAdmin: boolean;
  isCommittee: boolean;
  isMember: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithStudentIdOrEmail: (account: string, password: string) => Promise<void>;
  createManagedMember: (input: ManagedMemberInput) => Promise<UserProfile>;
  updateMyProfile: (data: Partial<UserProfile>) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ownerProfile = (user: User): UserProfile => ({
  uid: user.uid,
  authUid: user.uid,
  name: user.displayName || '李班长（超级管理员）',
  email: OWNER_EMAIL,
  studentId: '20260001',
  role: 'super_admin',
  approved: true,
  disabled: false,
  avatar: user.photoURL || 'https://api.dicebear.com/7.x/bottts/svg?seed=class-owner',
  birthday: '2008-01-01',
  bio: '班级空间超级管理员 / 班长',
  phone: '',
  createdAt: new Date().toISOString()
});

const removeLegacySecrets = (profile: UserProfile): UserProfile => {
  const clean = { ...profile } as UserProfile & { password?: string };
  delete clean.passwordHash;
  delete clean.password;
  return clean;
};

const clearLegacyAccessCaches = () => {
  localStorage.removeItem('class_space_cached_profile');
  localStorage.removeItem('class_space_admin_override');
  localStorage.removeItem('class_space_cached_settings');
  Object.keys(localStorage)
    .filter((key) => key.startsWith('class_space_registered_'))
    .forEach((key) => localStorage.removeItem(key));
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  const loadAuthorizedProfile = useCallback(async (user: User): Promise<UserProfile> => {
    if (user.isAnonymous) {
      throw new Error('匿名账号无权访问班级空间');
    }

    if (isOwnerGoogleUser(user)) {
      const existing = await getUserProfile(user.uid);
      const canonical = removeLegacySecrets({
        ...ownerProfile(user),
        ...(existing || {}),
        uid: user.uid,
        authUid: user.uid,
        email: OWNER_EMAIL,
        role: 'super_admin',
        studentId: '20260001'
      });
      await saveUserProfile(canonical);
      return canonical;
    }

    const existing = await getUserProfile(user.uid);
    if (!existing || existing.authUid !== user.uid || existing.approved !== true || existing.disabled) {
      throw new Error('此账号尚未获得管理员批准，或访问权限已被撤销');
    }

    const canonical = removeLegacySecrets({
      ...existing,
      uid: user.uid,
      authUid: user.uid,
      role: existing.role === 'super_admin' ? 'member' : existing.role
    });

    if (existing.uid !== user.uid || existing.passwordHash) {
      await saveUserProfile(canonical);
    }

    return canonical;
  }, []);

  useEffect(() => {
    let active = true;
    clearLegacyAccessCaches();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!active) return;
      setLoading(true);
      setAccessError(null);

      if (!user) {
        setCurrentUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        const authorizedProfile = await loadAuthorizedProfile(user);
        if (!active) return;
        setCurrentUser(user);
        setProfile(authorizedProfile);
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : '无法验证班级访问权限';
        setAccessError(message);
        setCurrentUser(null);
        setProfile(null);
        await signOut(auth).catch(() => undefined);
      } finally {
        if (active) setLoading(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [loadAuthorizedProfile]);

  const finishLogin = async (user: User) => {
    try {
      const authorizedProfile = await loadAuthorizedProfile(user);
      setAccessError(null);
      setCurrentUser(user);
      setProfile(authorizedProfile);
    } catch (error) {
      await signOut(auth).catch(() => undefined);
      setCurrentUser(null);
      setProfile(null);
      throw error;
    }
  };

  const loginWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    await finishLogin(result.user);
  };

  const loginWithStudentIdOrEmail = async (accountRaw: string, password: string) => {
    const account = accountRaw.trim();
    if (!account || !password) {
      throw new Error('请输入学号和密码');
    }
    if (account.includes('@')) {
      throw new Error('成员请使用学号登录；管理员请使用下方 Google 登录');
    }

    const result = await signInWithEmailAndPassword(
      auth,
      getStudentAuthEmail(account),
      password
    );
    await finishLogin(result.user);
  };

  const createManagedMember = async (input: ManagedMemberInput): Promise<UserProfile> => {
    if (!isOwnerGoogleUser(currentUser)) {
      throw new Error('只有已验证的超级管理员可以创建成员账号');
    }

    const studentId = input.studentId.trim();
    const name = input.name.trim();
    const email = input.email?.trim().toLowerCase() || `${studentId}@class.local`;
    if (!studentId || !name || !input.password) {
      throw new Error('请完整填写学号、姓名和初始密码');
    }
    if (input.password.length < 8) {
      throw new Error('初始密码至少需要 8 位');
    }

    const authUser = await createManagedAuthUser(studentId, input.password);
    const memberProfile: UserProfile = {
      uid: authUser.uid,
      authUid: authUser.uid,
      name,
      email,
      studentId,
      role: input.role,
      approved: true,
      disabled: false,
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=student_${encodeURIComponent(studentId)}`,
      birthday: '2008-06-15',
      bio: '班级成员',
      createdAt: new Date().toISOString()
    };
    await saveUserProfile(memberProfile);
    return memberProfile;
  };

  const updateMyProfile = async (data: Partial<UserProfile>) => {
    if (!profile) {
      throw new Error('当前未登录');
    }

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
    await signOut(auth);
    clearLegacyAccessCaches();
    setCurrentUser(null);
    setProfile(null);
    setAccessError(null);
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
    createManagedMember,
    updateMyProfile,
    logout
  }), [currentUser, profile, loading, accessError, isSuperAdmin]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export { getStudentAuthEmail } from '../authConfig';
