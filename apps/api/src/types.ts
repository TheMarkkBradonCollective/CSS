export type UserRole = "business" | "specialist" | "admin";

export type Bindings = {
  DATABASE_URL: string;
  REPORT_PHOTOS: R2Bucket;
  ENVIRONMENT?: string;
};

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
};

export type Variables = {
  user: AuthUser;
};

export type MissionType =
  | "customer_experience"
  | "quality_check"
  | "field_agent"
  | "mystery_shopping"
  | "compliance"
  | "brand_audit"
  | "custom";

export type MissionStatus =
  | "draft"
  | "open"
  | "assigned"
  | "completed"
  | "cancelled";

export type AssignmentStatus =
  | "accepted"
  | "in_progress"
  | "submitted"
  | "approved"
  | "rejected";
