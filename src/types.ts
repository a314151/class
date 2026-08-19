export type UserRole = 'super_admin' | 'committee' | 'member';

export interface UserProfile {
  uid: string;
  authUid?: string;
  name: string;
  email: string;
  studentId: string;
  role: UserRole;
  avatar: string;
  birthday?: string; // YYYY-MM-DD
  phone?: string;
  bio?: string;
  passwordHash?: string;
  createdAt: string;
}

export type NoticeCategory = 'urgent' | 'exam' | 'activity' | 'fee' | 'holiday' | 'academic' | 'routine';

export interface Notice {
  id: string;
  title: string;
  content: string;
  category: NoticeCategory;
  isPinned: boolean;
  authorName: string;
  authorUid: string;
  readBy: string[]; // array of user UIDs
  createdAt: string;
  attachmentUrl?: string;
  attachmentName?: string;
}

export interface ScheduleItem {
  id: string;
  dayOfWeek: number; // 1 = Monday ... 7 = Sunday
  period: number; // 1 to 8
  subject: string;
  teacher: string;
  room: string;
  timeRange: string;
  weekType?: 'all' | 'odd' | 'even';
}

export type SchoolEventCategory = 'holiday' | 'exam' | 'activity' | 'academic';

export interface SchoolEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  category: SchoolEventCategory;
  description: string;
  location?: string;
}

export interface ChatMessage {
  id: string;
  senderUid: string;
  senderName: string;
  senderAvatar: string;
  senderRole: UserRole;
  content: string;
  attachmentUrl?: string;
  createdAt: string;
  isPinned?: boolean;
  replyTo?: {
    id: string;
    senderName: string;
    content: string;
  };
}

export interface DirectMessage {
  id: string;
  conversationId: string; // sorted uids: uid1_uid2
  senderUid: string;
  recipientUid: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  attachmentUrl?: string;
  createdAt: string;
  isRead?: boolean;
}

export interface BirthdayWish {
  id: string;
  targetUid: string;
  targetName: string;
  senderUid: string;
  senderName: string;
  senderAvatar: string;
  message: string;
  createdAt: string;
  updatedAt?: string;
  likes?: string[];
}

export interface PollOption {
  id: string;
  text: string;
  voterUids: string[]; // List of UIDs who voted for this option
}

export interface Poll {
  id: string;
  title: string;
  description: string;
  options: PollOption[];
  isMultiple: boolean;
  isAnonymous: boolean;
  deadline: string; // ISO string or YYYY-MM-DD
  authorUid: string;
  authorName: string;
  createdAt: string;
}

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'radio' | 'checkbox' | 'file';
  options?: string[]; // for radio/checkbox
  required: boolean;
  placeholder?: string;
}

export interface FormSubmission {
  studentUid: string;
  studentName: string;
  studentId: string;
  submittedAt: string;
  answers: Record<string, any>;
}

export interface FormCollection {
  id: string;
  title: string;
  description: string;
  fields: FormField[];
  deadline: string;
  authorUid: string;
  authorName: string;
  createdAt: string;
  submissions?: Record<string, FormSubmission>; // uid -> submission
}

export type FeedbackCategory = 'teaching' | 'management' | 'activity' | 'life' | 'other';
export type FeedbackStatus = 'pending' | 'processing' | 'resolved';

export interface FeedbackItem {
  id: string;
  title: string;
  content: string;
  category: FeedbackCategory;
  isAnonymous: boolean;
  authorUid: string;
  authorName: string;
  status: FeedbackStatus;
  reply?: string;
  replyAuthor?: string;
  repliedAt?: string;
  createdAt: string;
}

export interface ClassSettings {
  className: string;
  motto: string;
  semester: string;
  announcement: string;
  cloudflareWorkerUrl?: string;
  r2BucketName?: string;
  superAdminEmail?: string;
}
