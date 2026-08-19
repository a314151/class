import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { 
  auth, 
  googleProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  signInAnonymously,
  sendPasswordResetEmail
} from '../firebase';
import { UserProfile, UserRole } from '../types';
import { 
  getUserProfile, 
  getUserProfileByStudentId, 
  saveUserProfile, 
  seedInitialClassData, 
  cleanupDuplicateUsers 
} from '../services/firestoreService';

interface AuthContextType {
  currentUser: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isSuperAdmin: boolean;
  isCommittee: boolean;
  isMember: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithStudentIdOrEmail: (account: string, pass: string) => Promise<void>;
  registerStudent: (studentId: string, name: string, email: string, pass: string) => Promise<void>;
  sendPasswordReset: (account: string) => Promise<{ email: string; name?: string }>;
  claimSuperAdmin: (key: string) => Promise<boolean>;
  updateMyProfile: (data: Partial<UserProfile>) => Promise<void>;
  logout: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, name: string, studentId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Owner / Super Admin Email & Default Secret Admin Key
const OWNER_EMAIL = 'lry674515314@gmail.com';
const ADMIN_SECRET_KEYS = ['lry123321'];
const CANONICAL_ADMIN_UID = 'admin_super_account';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('class_space_cached_profile');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [adminOverride, setAdminOverride] = useState<boolean>(() => {
    try {
      return localStorage.getItem('class_space_admin_override') === 'true';
    } catch {
      return false;
    }
  });
  const [loading, setLoading] = useState(true);

  // Initialize and run deduplication on start
  useEffect(() => {
    cleanupDuplicateUsers().catch((e) => console.warn('Deduplication cleanup notice:', e));
  }, []);

  const getCanonicalAdminProfile = (): UserProfile => ({
    uid: CANONICAL_ADMIN_UID,
    name: '李班长 (超级管理员)',
    email: OWNER_EMAIL,
    studentId: '20260001',
    role: 'super_admin',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=admin_canonical',
    birthday: '2008-01-01',
    bio: '班级空间超级管理员 / 班长',
    phone: '',
    createdAt: new Date().toISOString()
  });

  const fetchOrCreateProfile = async (user: User, customRole?: UserRole, initialName?: string, initialStudentId?: string) => {
    try {
      const isOwner = user.email?.toLowerCase() === OWNER_EMAIL.toLowerCase() || adminOverride;

      if (isOwner) {
        const adminProf = getCanonicalAdminProfile();
        await saveUserProfile(adminProf);
        setProfile(adminProf);
        localStorage.setItem('class_space_cached_profile', JSON.stringify(adminProf));
        await seedInitialClassData(adminProf.uid, adminProf.name);
        return;
      }

      // If anonymous user without explicit registration, do NOT create random user in Firestore!
      if (user.isAnonymous && !initialStudentId) {
        return;
      }

      // Check existing by studentId first if provided
      let existing: UserProfile | null = null;
      if (initialStudentId) {
        existing = await getUserProfileByStudentId(initialStudentId);
      }
      if (!existing) {
        existing = await getUserProfile(user.uid);
      }

      if (!existing && initialStudentId) {
        const canonicalStudentUid = `student_${initialStudentId.trim()}`;
        const newProfile: UserProfile = {
          uid: canonicalStudentUid,
          name: initialName || user.displayName || '同学',
          email: user.email || `${initialStudentId}@class.local`,
          studentId: initialStudentId.trim(),
          role: customRole || 'member',
          avatar: user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=student_${initialStudentId}`,
          birthday: '2008-06-15',
          bio: '热爱班集体，努力学习，共同进步！',
          createdAt: new Date().toISOString()
        };
        await saveUserProfile(newProfile);
        existing = newProfile;
      } else if (existing && initialName) {
        existing = {
          ...existing,
          name: initialName,
          email: user.email || existing.email
        };
        await saveUserProfile(existing);
      }

      if (existing) {
        setProfile(existing);
        localStorage.setItem('class_space_cached_profile', JSON.stringify(existing));
      }
    } catch (err) {
      console.warn('Profile fetch error, using local fallback:', err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        if (adminOverride || user.email?.toLowerCase() === OWNER_EMAIL.toLowerCase()) {
          const adminProf = getCanonicalAdminProfile();
          setProfile(adminProf);
          localStorage.setItem('class_space_cached_profile', JSON.stringify(adminProf));
          saveUserProfile(adminProf).catch(() => {});
        } else if (!user.isAnonymous) {
          await fetchOrCreateProfile(user);
        }
      } else {
        // Ensure anonymous auth for security rules without creating extra Firestore user records
        try {
          await signInAnonymously(auth);
        } catch (anonErr) {
          console.warn('Anonymous auth note:', anonErr);
        }
        if (adminOverride) {
          const adminProf = getCanonicalAdminProfile();
          setProfile(adminProf);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [adminOverride]);

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        await fetchOrCreateProfile(result.user);
      }
    } catch (error) {
      console.error('Google Sign-in failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Register student with studentId, name, email and password binding
  const registerStudent = async (studentIdRaw: string, nameRaw: string, emailRaw: string, pass: string) => {
    setLoading(true);
    const studentId = studentIdRaw.trim();
    const name = nameRaw.trim();
    const email = emailRaw.trim();

    if (!studentId || !name || !email || !pass) {
      setLoading(false);
      throw new Error('请完整填入学号、姓名、邮箱和密码');
    }

    // Check if studentId has already been registered
    const existing = await getUserProfileByStudentId(studentId);
    if (existing) {
      setLoading(false);
      throw new Error(`学号【${studentId}】已被注册！每个学号仅能绑定一次初始密码。如您是该同学，请直接输入学号与密码登录；若忘记密码请使用“找回密码”功能。`);
    }

    try {
      const result = await createUserWithEmailAndPassword(auth, email, pass);
      const isOwner = email.toLowerCase() === OWNER_EMAIL.toLowerCase() || adminOverride;
      const canonicalUid = isOwner ? CANONICAL_ADMIN_UID : `student_${studentId}`;

      const newProfile: UserProfile = {
        uid: canonicalUid,
        name: name,
        email: email,
        studentId: studentId,
        role: isOwner ? 'super_admin' : 'member',
        avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=student_${studentId}`,
        birthday: '2008-06-15',
        bio: isOwner ? '班级空间超级管理员 / 班长' : '热爱班集体，努力学习，共同进步！',
        createdAt: new Date().toISOString()
      };

      await saveUserProfile(newProfile);
      setProfile(newProfile);
      localStorage.setItem('class_space_cached_profile', JSON.stringify(newProfile));
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        throw new Error(`邮箱【${email}】已被其他账号使用，请使用您自己的常用邮箱或直接使用找回密码功能。`);
      } else if (error.code === 'auth/weak-password') {
        throw new Error('密码强度过低，密码长度至少需 6 位字符');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('请输入有效的邮箱地址格式（如：example@school.com）');
      }
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Login with studentId (or email) and password
  const loginWithStudentIdOrEmail = async (accountRaw: string, pass: string) => {
    setLoading(true);
    const account = accountRaw.trim();
    if (!account || !pass) {
      setLoading(false);
      throw new Error('请输入学号（或邮箱）以及对应密码');
    }

    try {
      let targetEmail = account;
      let matchedProfile: UserProfile | null = null;

      // If input is student ID (does not contain @)
      if (!account.includes('@')) {
        matchedProfile = await getUserProfileByStudentId(account);
        if (!matchedProfile) {
          throw new Error(`未找到学号【${account}】的注册信息，请先注册该学号加入班级。`);
        }
        targetEmail = matchedProfile.email;
      }

      const result = await signInWithEmailAndPassword(auth, targetEmail, pass);
      if (result.user) {
        if (targetEmail.toLowerCase() === OWNER_EMAIL.toLowerCase()) {
          setAdminOverride(true);
          localStorage.setItem('class_space_admin_override', 'true');
          const adminProf = getCanonicalAdminProfile();
          setProfile(adminProf);
          localStorage.setItem('class_space_cached_profile', JSON.stringify(adminProf));
        } else {
          if (!matchedProfile) {
            matchedProfile = await getUserProfile(result.user.uid) || await getUserProfileByStudentId(account);
          }
          if (matchedProfile) {
            setProfile(matchedProfile);
            localStorage.setItem('class_space_cached_profile', JSON.stringify(matchedProfile));
          }
        }
      }
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') {
        throw new Error('学号或密码错误！请核对您注册时填写的密码，若忘记密码请点击下方“找回密码”。');
      } else if (error.code === 'auth/too-many-requests') {
        throw new Error('密码错误尝试次数过多，系统已临时保护，请稍后再试或通过邮箱重置密码。');
      }
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Send password reset email
  const sendPasswordReset = async (accountRaw: string): Promise<{ email: string; name?: string }> => {
    setLoading(true);
    const account = accountRaw.trim();
    if (!account) {
      setLoading(false);
      throw new Error('请输入您注册时的学号或绑定邮箱');
    }

    try {
      let targetEmail = account;
      let studentName = '';

      if (!account.includes('@')) {
        const studentProfile = await getUserProfileByStudentId(account);
        if (!studentProfile) {
          throw new Error(`未找到学号【${account}】的注册记录，请核对学号是否输入正确。`);
        }
        targetEmail = studentProfile.email;
        studentName = studentProfile.name;
      }

      await sendPasswordResetEmail(auth, targetEmail);
      return { email: targetEmail, name: studentName };
    } catch (error: any) {
      console.error('Password reset error:', error);
      if (error.code === 'auth/user-not-found') {
        throw new Error(`未找到邮箱为【${account}】的用户，请确认注册信息。`);
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('邮箱格式不正确，请重新输入。');
      }
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Backwards compatibility wrappers
  const loginWithEmail = async (email: string, pass: string) => {
    return loginWithStudentIdOrEmail(email, pass);
  };

  const registerWithEmail = async (email: string, pass: string, name: string, studentId: string) => {
    return registerStudent(studentId, name, email, pass);
  };

  const claimSuperAdmin = async (key: string): Promise<boolean> => {
    const trimmed = key.trim();
    const isValidKey = ADMIN_SECRET_KEYS.some(k => k === trimmed);
    const isOwnerByEmail = currentUser?.email?.toLowerCase() === OWNER_EMAIL.toLowerCase();

    if (!isValidKey && !isOwnerByEmail) {
      return false;
    }

    try {
      setAdminOverride(true);
      localStorage.setItem('class_space_admin_override', 'true');

      const adminProfile = getCanonicalAdminProfile();
      setProfile(adminProfile);
      localStorage.setItem('class_space_cached_profile', JSON.stringify(adminProfile));

      // Asynchronously sync to database and clean up duplicates
      await saveUserProfile(adminProfile);
      await seedInitialClassData(adminProfile.uid, adminProfile.name);
      await cleanupDuplicateUsers();

      return true;
    } catch (err) {
      console.error('claimSuperAdmin error:', err);
      return true;
    }
  };

  const updateMyProfile = async (data: Partial<UserProfile>) => {
    if (!profile) return;
    const updated = { ...profile, ...data };
    setProfile(updated);
    localStorage.setItem('class_space_cached_profile', JSON.stringify(updated));
    try {
      await saveUserProfile(updated);
    } catch (e) {
      console.warn('Failed to persist profile updates to Firestore:', e);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('SignOut error:', e);
    }
    setAdminOverride(false);
    localStorage.removeItem('class_space_admin_override');
    localStorage.removeItem('class_space_cached_profile');
    setProfile(null);
    setCurrentUser(null);
  };

  const isSuperAdmin = adminOverride || profile?.role === 'super_admin' || currentUser?.email?.toLowerCase() === OWNER_EMAIL.toLowerCase();
  const isCommittee = isSuperAdmin || profile?.role === 'committee';
  const isMember = !!profile;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        profile,
        loading,
        isSuperAdmin,
        isCommittee,
        isMember,
        loginWithGoogle,
        loginWithStudentIdOrEmail,
        registerStudent,
        sendPasswordReset,
        claimSuperAdmin,
        updateMyProfile,
        logout,
        loginWithEmail,
        registerWithEmail
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
