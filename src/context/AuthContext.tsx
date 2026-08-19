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
  sendPasswordResetEmail
} from '../firebase';
import { UserProfile, UserRole } from '../types';
import { 
  getUserProfile, 
  getUserProfileByStudentId, 
  getUserProfileByEmail,
  saveUserProfile,
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
  signIn: (studentId: string, pass: string) => Promise<void>;
  signUp: (studentId: string, name: string, email: string, pass: string) => Promise<void>;
  sendPasswordReset: (account: string) => Promise<{ email: string; name?: string }>;
  claimSuperAdmin: (key: string) => Promise<boolean>;
  updateMyProfile: (data: Partial<UserProfile>) => Promise<void>;
  logout: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, name: string, studentId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper for deterministic internal student auth email
export const getStudentAuthEmail = (studentId: string) => `stu_${studentId.trim().toLowerCase()}@class.student.internal`;

// Cryptographic password hashing using Web Crypto SHA-256
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + '_class_space_secure_salt_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

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
        return;
      }

      // If anonymous user without explicit registration, do NOT create random user in Firestore!
      if (user.isAnonymous && !initialStudentId) {
        return;
      }

      // Check existing by studentId, uid, or email
      let existing: UserProfile | null = null;
      if (initialStudentId) {
        existing = await getUserProfileByStudentId(initialStudentId);
      }
      if (!existing) {
        existing = await getUserProfile(user.uid);
      }
      if (!existing && user.email) {
        existing = await getUserProfileByEmail(user.email);
      }

      if (!existing && initialStudentId) {
        const canonicalStudentUid = `student_${initialStudentId.trim()}`;
        const newProfile: UserProfile = {
          uid: canonicalStudentUid,
          authUid: user.uid,
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
      } else if (!existing && user.email) {
        const inferredStudentId = user.email.split('@')[0];
        const newProfile: UserProfile = {
          uid: `student_${inferredStudentId}`,
          authUid: user.uid,
          name: initialName || user.displayName || '同学',
          email: user.email,
          studentId: inferredStudentId,
          role: customRole || 'member',
          avatar: user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=student_${inferredStudentId}`,
          birthday: '2008-06-15',
          bio: '热爱班集体，努力学习，共同进步！',
          createdAt: new Date().toISOString()
        };
        await saveUserProfile(newProfile);
        existing = newProfile;
      } else if (existing) {
        // Ensure authUid is linked
        if (!existing.authUid || existing.authUid !== user.uid) {
          existing = { ...existing, authUid: user.uid };
          saveUserProfile(existing).catch(() => {});
        }
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
    let isActive = true;
    const loadingFallback = window.setTimeout(() => {
      if (isActive) {
        setLoading(false);
      }
    }, 1500);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!isActive) return;

      setCurrentUser(user);
      window.clearTimeout(loadingFallback);
      setLoading(false);

      if (user && !user.isAnonymous) {
        // Refresh a missing profile in the background. Profile I/O must never
        // block the first paint, especially on high-latency mobile networks.
        if (!profile) {
          void fetchOrCreateProfile(user);
        }
      }
    });

    return () => {
      isActive = false;
      window.clearTimeout(loadingFallback);
      unsubscribe();
    };
  }, []);

  const loginWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        await fetchOrCreateProfile(result.user);
      }
    } catch (error) {
      console.error('Google Sign-in failed:', error);
      throw error;
    }
  };

  // Sign up (register) student with studentId as unique key & SHA-256 password hash
  const signUp = async (studentIdRaw: string, nameRaw: string, emailRaw: string, pass: string) => {
    const studentId = studentIdRaw.trim();
    const name = nameRaw.trim();
    const email = emailRaw.trim();

    if (!studentId || !name || !pass) {
      throw new Error('请完整填入学号、姓名和密码');
    }

    if (pass.length < 6) {
      throw new Error('为保障账号安全，密码长度至少需要 6 位字符');
    }

    try {
      // 1. Check if studentId already exists in Firestore users collection
      const existing = await getUserProfileByStudentId(studentId);
      if (existing) {
        throw new Error(`学号【${studentId}】已被注册！每个学号仅能绑定一次初始密码。如您是该同学，请直接使用学号和密码登录；若忘记密码请使用“找回密码”功能。`);
      }

      // 2. Hash password with SHA-256
      const hashedPass = await hashPassword(pass);

      const isSuperAdminAccount = studentId === '20260001';
      const docUid = isSuperAdminAccount ? CANONICAL_ADMIN_UID : studentId;

      const newProfile: UserProfile = {
        uid: docUid,
        name: name,
        email: email || `${studentId}@class.local`,
        studentId: studentId,
        passwordHash: hashedPass,
        role: isSuperAdminAccount ? 'super_admin' : 'member',
        avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=student_${studentId}`,
        birthday: '2008-06-15',
        bio: isSuperAdminAccount ? '班级空间超级管理员 / 班长' : '热爱班集体，努力学习，共同进步！',
        createdAt: new Date().toISOString()
      };

      // 3. Save directly to Firestore users collection
      await saveUserProfile(newProfile);

      // 4. Update local state and cache (and reset any previous admin override)
      if (!isSuperAdminAccount) {
        setAdminOverride(false);
        localStorage.removeItem('class_space_admin_override');
      }

      setProfile(newProfile);
      localStorage.setItem('class_space_cached_profile', JSON.stringify(newProfile));
      localStorage.setItem(`class_space_registered_${studentId}`, JSON.stringify(newProfile));

      // 5. Background sync with Firebase Auth
      try {
        const internalAuthEmail = getStudentAuthEmail(studentId);
        const authRes = await createUserWithEmailAndPassword(auth, internalAuthEmail, pass);
        if (authRes.user) {
          newProfile.authUid = authRes.user.uid;
          await saveUserProfile(newProfile);
        }
      } catch (authErr) {
        // Non-blocking: Firestore is authoritative
      }
    } catch (error: any) {
      console.error('Sign up error:', error);
      throw error;
    }
  };

  // Alias for backward compatibility
  const registerStudent = signUp;

  // Sign in student by checking studentId and verifying hashed password in Firestore
  const signIn = async (accountRaw: string, pass: string) => {
    const account = accountRaw.trim();
    if (!account || !pass) {
      throw new Error('请输入学号以及对应密码');
    }

    try {
      // 1. Explicit Owner Email login
      if (account.toLowerCase() === OWNER_EMAIL.toLowerCase() && pass === 'lry123321') {
        setAdminOverride(true);
        localStorage.setItem('class_space_admin_override', 'true');
        const adminProf = getCanonicalAdminProfile();
        setProfile(adminProf);
        localStorage.setItem('class_space_cached_profile', JSON.stringify(adminProf));
        await saveUserProfile(adminProf);
        return;
      }

      // 2. Query Firestore users collection by studentId or email
      let matchedProfile: UserProfile | null = await getUserProfileByStudentId(account);
      if (!matchedProfile && account.includes('@')) {
        matchedProfile = await getUserProfileByEmail(account);
      }
      if (!matchedProfile) {
        matchedProfile = await getUserProfile(account) || await getUserProfile(`student_${account}`);
      }

      // 3. If not found in Firestore
      if (!matchedProfile) {
        throw new Error(`后台数据库中未找到学号【${account}】的账号记录！请先点击“新同学注册学号”，填入学号、姓名、邮箱和密码完成注册。`);
      }

      // 4. Verify password hash
      const inputHash = await hashPassword(pass);
      let isMatch = false;

      if (matchedProfile.passwordHash) {
        isMatch = (matchedProfile.passwordHash === inputHash);
      } else if ((matchedProfile as any).password) {
        isMatch = ((matchedProfile as any).password === pass);
        if (isMatch) {
          matchedProfile.passwordHash = inputHash;
          await saveUserProfile(matchedProfile);
        }
      } else {
        // Legacy record without stored hash: bind password on first login
        isMatch = true;
        matchedProfile.passwordHash = inputHash;
        await saveUserProfile(matchedProfile);
      }

      if (!isMatch) {
        throw new Error(`学号【${account}】密码输入错误！请核对您注册时设置的密码；若忘记密码请点击下方“找回密码”。`);
      }

      // 5. Successful login: update state & role
      if (matchedProfile.role === 'super_admin' || matchedProfile.studentId === '20260001') {
        setAdminOverride(true);
        localStorage.setItem('class_space_admin_override', 'true');
      } else {
        setAdminOverride(false);
        localStorage.removeItem('class_space_admin_override');
      }

      setProfile(matchedProfile);
      localStorage.setItem('class_space_cached_profile', JSON.stringify(matchedProfile));
      localStorage.setItem(`class_space_registered_${matchedProfile.studentId}`, JSON.stringify(matchedProfile));

      // 6. Background sync with Firebase Auth
      try {
        const internalAuthEmail = getStudentAuthEmail(matchedProfile.studentId);
        await signInWithEmailAndPassword(auth, internalAuthEmail, pass);
      } catch (e) {
        // Non-blocking: Firestore is authoritative
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  // Alias for backward compatibility
  const loginWithStudentIdOrEmail = signIn;

  // Send password reset email
  const sendPasswordReset = async (accountRaw: string): Promise<{ email: string; name?: string }> => {
    const account = accountRaw.trim();
    if (!account) {
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

  const isSuperAdmin = !!profile && (profile.role === 'super_admin' || profile.uid === CANONICAL_ADMIN_UID || profile.studentId === '20260001');
  const isCommittee = isSuperAdmin || (!!profile && profile.role === 'committee');
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
        signIn,
        signUp,
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
