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
  signInAnonymously
} from '../firebase';
import { UserProfile, UserRole } from '../types';
import { getUserProfile, saveUserProfile, seedInitialClassData } from '../services/firestoreService';

interface AuthContextType {
  currentUser: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isSuperAdmin: boolean;
  isCommittee: boolean;
  isMember: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, name: string, studentId: string) => Promise<void>;
  claimSuperAdmin: (key: string) => Promise<boolean>;
  updateMyProfile: (data: Partial<UserProfile>) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Owner / Super Admin Email & Default Secret Admin Key
const OWNER_EMAIL = 'lry674515314@gmail.com';
const ADMIN_SECRET_KEYS = ['lry123321'];

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

  const fetchOrCreateProfile = async (user: User, customRole?: UserRole, initialName?: string, initialStudentId?: string) => {
    try {
      let existing = await getUserProfile(user.uid);
      const isOwner = user.email?.toLowerCase() === OWNER_EMAIL.toLowerCase() || adminOverride;
      if (!existing) {
        const assignedRole: UserRole = customRole || (isOwner ? 'super_admin' : 'member');
        const newProfile: UserProfile = {
          uid: user.uid,
          name: initialName || user.displayName || (isOwner ? '李班长 (超级管理员)' : '同学'),
          email: user.email || `${user.uid.slice(0, 6)}@class.local`,
          studentId: initialStudentId || `2026${Math.floor(1000 + Math.random() * 9000)}`,
          role: assignedRole,
          avatar: user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`,
          birthday: '2008-06-15',
          bio: isOwner ? '班级空间超级管理员 / 班长' : '热爱班集体，努力学习，共同进步！',
          createdAt: new Date().toISOString()
        };
        await saveUserProfile(newProfile);
        existing = newProfile;
      } else if (isOwner && existing.role !== 'super_admin') {
        existing = { ...existing, role: 'super_admin' };
        await saveUserProfile(existing);
      }
      setProfile(existing);
      localStorage.setItem('class_space_cached_profile', JSON.stringify(existing));

      // Trigger initial seeding if first time
      if (existing.role === 'super_admin') {
        await seedInitialClassData(existing.uid, existing.name);
      }
    } catch (err) {
      console.warn('Profile fetch error, using local fallback:', err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchOrCreateProfile(user);
      } else {
        // If not logged in, check if we have adminOverride or local profile
        if (!adminOverride) {
          setProfile((prev) => (prev?.role === 'super_admin' ? prev : null));
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

  const loginWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email, pass);
      if (result.user) {
        await fetchOrCreateProfile(result.user);
      }
    } catch (error) {
      console.error('Email login failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const registerWithEmail = async (email: string, pass: string, name: string, studentId: string) => {
    setLoading(true);
    try {
      const result = await createUserWithEmailAndPassword(auth, email, pass);
      if (result.user) {
        const isOwner = email.toLowerCase() === OWNER_EMAIL.toLowerCase() || adminOverride;
        await fetchOrCreateProfile(result.user, isOwner ? 'super_admin' : 'member', name, studentId);
      }
    } catch (error) {
      console.error('Email register failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
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

      const adminUid = currentUser?.uid || profile?.uid || `admin_local_${Date.now()}`;
      const adminProfile: UserProfile = {
        uid: adminUid,
        name: profile?.name || '李班长 (超级管理员)',
        email: currentUser?.email || OWNER_EMAIL,
        studentId: profile?.studentId || '20260001',
        role: 'super_admin',
        avatar: profile?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=admin_${adminUid}`,
        birthday: profile?.birthday || '2008-01-01',
        bio: profile?.bio || '班级空间超级管理员 / 班长',
        phone: profile?.phone || '',
        createdAt: profile?.createdAt || new Date().toISOString()
      };

      setProfile(adminProfile);
      localStorage.setItem('class_space_cached_profile', JSON.stringify(adminProfile));

      // Asynchronously sync to database without blocking
      saveUserProfile(adminProfile).catch((e) => console.warn('Sync profile to Firestore error:', e));
      seedInitialClassData(adminUid, adminProfile.name).catch((e) => console.warn('Seed error:', e));

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
        loginWithEmail,
        registerWithEmail,
        claimSuperAdmin,
        updateMyProfile,
        logout
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
