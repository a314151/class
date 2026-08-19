import type { User } from 'firebase/auth';

export const OWNER_EMAIL = 'lry674515314@gmail.com';

export const getStudentAuthEmail = (studentId: string) =>
  `stu_${studentId.trim().toLowerCase()}@class.student.internal`;

export const isOwnerGoogleUser = (user: User | null | undefined): boolean => {
  if (!user || !user.emailVerified || user.email?.toLowerCase() !== OWNER_EMAIL) {
    return false;
  }

  return user.providerData.some((provider) => provider.providerId === 'google.com');
};
