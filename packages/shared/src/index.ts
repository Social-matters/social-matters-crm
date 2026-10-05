import { z } from 'zod';

// ==========================================
// 1. ENUMS
// ==========================================

export enum OrgType {
  AGENCY = 'AGENCY',
  CLIENT = 'CLIENT',
}

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  AGENCY_ACCOUNT_MANAGER = 'AGENCY_ACCOUNT_MANAGER',
  CLIENT_ADMIN = 'CLIENT_ADMIN',
  CLIENT_SALES_USER = 'CLIENT_SALES_USER',
  CUSTOM = 'CUSTOM',
}

export enum LeadStatus {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  INTERESTED = 'INTERESTED',
  FOLLOW_UP = 'FOLLOW_UP',
  CONVERTED = 'CONVERTED',
  LOST = 'LOST',
}

export enum FollowUpStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  OVERDUE = 'OVERDUE',
}

export enum PlatformType {
  META = 'META',
  GOOGLE = 'GOOGLE',
  LINKEDIN = 'LINKEDIN',
  WHATSAPP = 'WHATSAPP',
  WEBSITE = 'WEBSITE',
  MANUAL = 'MANUAL',
}

export enum IntegrationStatus {
  CONNECTED = 'CONNECTED',
  SYNCING = 'SYNCING',
  ERROR = 'ERROR',
  DISCONNECTED = 'DISCONNECTED',
}

// ==========================================
// 2. PERMISSIONS
// ==========================================

export const PERMISSIONS = {
  // Client Management
  CLIENTS_MANAGE: 'clients:manage',
  CLIENTS_VIEW_ALL: 'clients:view_all',
  CLIENTS_VIEW_ASSIGNED: 'clients:view_assigned',
  
  // User Management
  AGENCY_USERS_MANAGE: 'agency_users:manage',
  CLIENT_USERS_MANAGE: 'client_users:manage',

  // Lead Management
  LEADS_VIEW_ALL: 'leads:view_all',
  LEADS_VIEW_ASSIGNED: 'leads:view_assigned',
  LEADS_CHANGE_STATUS: 'leads:change_status',
  LEADS_ADD_NOTES: 'leads:add_notes',
  LEADS_SCHEDULE_FOLLOWUP: 'leads:schedule_followup',
  LEADS_RECORD_CONVERSION: 'leads:record_conversion',
  LEADS_ASSIGN_SALES_USER: 'leads:assign_sales_user',
  LEADS_EXPORT: 'leads:export',
  
  // Analytics & Integrations
  ANALYTICS_AGENCY_CONSOLIDATED: 'analytics:agency_consolidated',
  ANALYTICS_CLIENT_VIEW: 'analytics:client_view',
  INTEGRATIONS_CONFIGURE: 'integrations:configure',
  INTEGRATIONS_MONITOR: 'integrations:monitor',
  FORMS_MANAGE: 'forms:manage',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// Role to default permissions mapping
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, PermissionKey[]> = {
  [UserRole.SUPER_ADMIN]: Object.values(PERMISSIONS),
  [UserRole.AGENCY_ACCOUNT_MANAGER]: [
    PERMISSIONS.CLIENTS_VIEW_ASSIGNED,
    PERMISSIONS.LEADS_VIEW_ALL,
    PERMISSIONS.ANALYTICS_CLIENT_VIEW,
    PERMISSIONS.INTEGRATIONS_MONITOR,
    PERMISSIONS.LEADS_EXPORT,
  ],
  [UserRole.CLIENT_ADMIN]: [
    PERMISSIONS.CLIENT_USERS_MANAGE,
    PERMISSIONS.LEADS_VIEW_ALL,
    PERMISSIONS.LEADS_CHANGE_STATUS,
    PERMISSIONS.LEADS_ADD_NOTES,
    PERMISSIONS.LEADS_SCHEDULE_FOLLOWUP,
    PERMISSIONS.LEADS_RECORD_CONVERSION,
    PERMISSIONS.LEADS_ASSIGN_SALES_USER,
    PERMISSIONS.LEADS_EXPORT,
    PERMISSIONS.ANALYTICS_CLIENT_VIEW,
    PERMISSIONS.FORMS_MANAGE,
  ],
  [UserRole.CLIENT_SALES_USER]: [
    PERMISSIONS.LEADS_VIEW_ASSIGNED,
    PERMISSIONS.LEADS_CHANGE_STATUS,
    PERMISSIONS.LEADS_ADD_NOTES,
    PERMISSIONS.LEADS_SCHEDULE_FOLLOWUP,
    PERMISSIONS.LEADS_RECORD_CONVERSION,
  ],
  [UserRole.CUSTOM]: [],
};

// ==========================================
// 3. VALIDATION SCHEMAS (ZOD)
// ==========================================

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const CreateOrganizationSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase letters, numbers, and dashes'),
  type: z.nativeEnum(OrgType).default(OrgType.CLIENT),
  settings: z.record(z.any()).optional(),
});
export type CreateOrganizationInput = z.infer<typeof CreateOrganizationSchema>;

export const CreateUserSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.nativeEnum(UserRole),
  customRoleId: z.string().uuid().optional(),
});
export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export const LeadFilterSchema = z.object({
  organizationId: z.string().uuid().optional(),
  sourcePlatform: z.nativeEnum(PlatformType).optional(),
  status: z.nativeEnum(LeadStatus).optional(),
  campaignId: z.string().optional(),
  assignedUserId: z.string().optional(),
  search: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  followUpStatus: z.nativeEnum(FollowUpStatus).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.string().default('submittedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type LeadFilterInput = z.infer<typeof LeadFilterSchema>;

export const UpdateLeadStatusSchema = z.object({
  status: z.nativeEnum(LeadStatus),
  notes: z.string().optional(),
});
export type UpdateLeadStatusInput = z.infer<typeof UpdateLeadStatusSchema>;

export const AddLeadNoteSchema = z.object({
  content: z.string().min(1, 'Note content cannot be empty'),
});
export type AddLeadNoteInput = z.infer<typeof AddLeadNoteSchema>;

export const ScheduleFollowUpSchema = z.object({
  scheduledAt: z.string().datetime(),
  reminderNote: z.string().optional(),
});
export type ScheduleFollowUpInput = z.infer<typeof ScheduleFollowUpSchema>;

export const RecordConversionSchema = z.object({
  value: z.number().positive('Conversion value must be greater than zero'),
  notes: z.string().optional(),
  conversionDate: z.string().datetime().optional(),
});
export type RecordConversionInput = z.infer<typeof RecordConversionSchema>;

export const ManualLeadCreationSchema = z.object({
  organizationId: z.string().uuid(),
  fullName: z.string().min(1, 'Full name is required'),
  phone: z.string().min(6, 'Valid phone number is required'),
  email: z.string().email().optional().or(z.literal('')),
  campaignName: z.string().optional(),
  customFields: z.record(z.string()).optional(),
  initialNotes: z.string().optional(),
});
export type ManualLeadCreationInput = z.infer<typeof ManualLeadCreationSchema>;
