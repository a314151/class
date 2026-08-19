import type { SessionUser } from './services/apiClient';

export const OWNER_EMAIL = 'lry674515314@gmail.com';

export const getStudentAuthEmail = (studentId: string) =>
  `stu_${studentId.trim().toLowerCase()}@class.student.internal`;

export const isOwnerGoogleUser = (user: SessionUser | null | undefined): boolean => {
  if (!user || !user.emailVerified || user.email?.toLowerCase() !== OWNER_EMAIL) {
    return false;
  }

  return user.providerData.some((provider) => provider.providerId === 'google.com');
};
