import { z } from 'zod';

const optionalText = z.string().trim().max(4000).optional();

export const loginSchema = z.object({
  email: z.string().trim().min(3).max(320),
  password: z.string().min(1).max(200),
});

const optionalUsd = z.coerce.number().finite().nonnegative().max(1_000_000).optional().nullable();

export const createJobSchema = z.object({
  ref: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(200),
  clientId: z.coerce.number().int().positive(),
  departmentId: z.coerce.number().int().positive(),
  scope: z.string().trim().max(8000).optional().nullable(),
  location: z.string().trim().max(200).optional().nullable(),
  startDate: z.string().min(8),
  endDate: z.string().min(8),
  priority: z.string().trim().max(40).optional(),
  estimatedHours: z.coerce.number().finite().nonnegative().max(10000).optional(),
  requiredInspectorCount: z.coerce.number().int().positive().max(50).optional(),
  jobTypeId: z.coerce.number().int().positive().optional().nullable(),
  certificationIds: z.array(z.coerce.number().int().positive()).optional(),
  requiresQeApproval: z.coerce.boolean().optional(),
  agreedPriceUsd: optionalUsd,
});

export const updateJobSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  scope: z.string().trim().max(8000).optional().nullable(),
  location: z.string().trim().max(200).optional().nullable(),
  startDate: z.string().min(8).optional(),
  endDate: z.string().min(8).optional(),
  priority: z.string().trim().max(40).optional(),
  estimatedHours: z.coerce.number().finite().nonnegative().max(10000).optional(),
  clientId: z.coerce.number().int().positive().optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  jobTypeId: z.coerce.number().int().positive().optional().nullable(),
  requiresQeApproval: z.coerce.boolean().optional(),
  agreedPriceUsd: optionalUsd,
});

export const assignJobSchema = z.object({
  inspectorId: z.coerce.number().int().positive(),
  role: z.string().trim().max(80).optional(),
  allocatedHours: z.coerce.number().finite().nonnegative().max(10000).optional(),
  agreedPriceUsd: optionalUsd,
});

export const completeJobSchema = z.object({
  inspectorId: z.coerce.number().int().positive(),
  comments: z.string().trim().max(8000).optional(),
  agreedPriceUsd: optionalUsd,
});

export const updateJobPriceSchema = z.object({
  agreedPriceUsd: z.coerce.number().finite().nonnegative().max(1_000_000),
});

export const inspectorCostsSchema = z.object({
  dailyCostUsd: z.coerce.number().finite().nonnegative().max(1_000_000),
  dailyBillableUsd: z.coerce.number().finite().nonnegative().max(1_000_000),
});

export const inspectorQeApprovedSchema = z.object({
  qeApproved: z.coerce.boolean(),
});

export const priceChartSchema = z.object({
  globalDefaultUsd: z.coerce.number().finite().nonnegative().max(1_000_000).optional(),
  items: z
    .array(
      z.object({
        jobTypeId: z.coerce.number().int().positive(),
        priceUsd: z.coerce.number().finite().nonnegative().max(1_000_000),
      })
    )
    .optional(),
});

export const createJobTypeSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  certificationIds: z.array(z.coerce.number().int().positive()).optional(),
  defaultPriceUsd: optionalUsd,
});

export const updateJobTypeSchema = z.object({
  code: z.string().trim().min(1).max(40).optional(),
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  active: z.coerce.boolean().optional(),
  certificationIds: z.array(z.coerce.number().int().positive()).optional(),
  defaultPriceUsd: optionalUsd,
});

export const createActivityLogSchema = z.object({
  jobId: z.coerce.number().int().positive(),
  inspectorId: z.coerce.number().int().positive(),
  logDate: z.string().min(8),
  hours: z.coerce.number().finite().nonnegative().max(24),
  productiveHours: z.coerce.number().finite().nonnegative().max(24),
  narrative: optionalText,
  qualityScore: z.coerce.number().int().min(0).max(100).optional(),
});

export const updateActivityLogSchema = z.object({
  logDate: z.string().min(8).optional(),
  hours: z.coerce.number().finite().nonnegative().max(24).optional(),
  productiveHours: z.coerce.number().finite().nonnegative().max(24).optional(),
  narrative: optionalText,
  qualityScore: z.coerce.number().int().min(0).max(100).optional(),
});

export const createLeaveSchema = z.object({
  type: z.string().trim().min(1).max(80),
  startDate: z.string().min(8),
  endDate: z.string().min(8),
  reason: optionalText,
  inspectorId: z.coerce.number().int().positive().optional(),
});

export const updateLeaveSchema = z.object({
  type: z.string().trim().min(1).max(80).optional(),
  startDate: z.string().min(8).optional(),
  endDate: z.string().min(8).optional(),
  reason: optionalText,
});

export const rejectAssignmentSchema = z.object({
  reason: z.string().trim().min(1).max(2000),
});
