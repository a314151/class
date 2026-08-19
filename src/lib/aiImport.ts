import { z } from 'zod';

export const noticeCategories = [
  'urgent',
  'exam',
  'activity',
  'fee',
  'holiday',
  'academic',
  'routine'
] as const;

export const schoolEventCategories = ['holiday', 'exam', 'activity', 'academic'] as const;

const ISO_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

const parseableIso = z.string().max(50).regex(
  ISO_WITH_ZONE,
  '必须是包含时区的 ISO 日期时间'
).refine(
  (value) => Number.isFinite(Date.parse(value)),
  '必须是有效的 ISO 日期时间'
);

const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '必须使用 YYYY-MM-DD').refine(
  (value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  },
  '必须是有效日期'
);

export const aiNoticeDraftSchema = z.strictObject({
  title: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(5000),
  category: z.enum(noticeCategories),
  isPinned: z.boolean().default(false),
  deadlineAt: parseableIso.nullable().default(null)
});

export const aiEventDraftSchema = z.strictObject({
  title: z.string().trim().min(1).max(120),
  date: calendarDate,
  startsAt: parseableIso.nullable().default(null),
  category: z.enum(schoolEventCategories),
  description: z.string().trim().max(3000).default(''),
  location: z.string().trim().max(200).nullable().default(null)
});

export const aiImportDraftSchema = z.strictObject({
  notice: aiNoticeDraftSchema.nullable(),
  events: z.array(aiEventDraftSchema).max(20),
  warnings: z.array(z.string().trim().min(1).max(300)).max(20).default([])
});

export type AiNoticeDraft = z.infer<typeof aiNoticeDraftSchema>;
export type AiEventDraft = z.infer<typeof aiEventDraftSchema>;
export type AiImportDraft = z.infer<typeof aiImportDraftSchema>;
