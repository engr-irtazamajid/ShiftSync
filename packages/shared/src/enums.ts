export enum Role {
  Admin = "admin",
  Manager = "manager",
  Staff = "staff",
}

export enum ShiftStatus {
  Draft = "draft",
  Published = "published",
  Cancelled = "cancelled",
}

export enum AssignmentStatus {
  Active = "active",
  Released = "released",
  Cancelled = "cancelled",
}

export enum SwapType {
  Swap = "swap",
  Drop = "drop",
}

export enum SwapStatus {
  PendingTargetAcceptance = "pending_target_acceptance",
  PendingClaim = "pending_claim",
  PendingManagerApproval = "pending_manager_approval",
  Approved = "approved",
  Denied = "denied",
  AutoCancelled = "auto_cancelled",
  Expired = "expired",
  Withdrawn = "withdrawn",
}

export const OPEN_SWAP_STATUSES: SwapStatus[] = [
  SwapStatus.PendingTargetAcceptance,
  SwapStatus.PendingClaim,
  SwapStatus.PendingManagerApproval,
];

export enum NotificationType {
  ShiftAssigned = "shift_assigned",
  ShiftChanged = "shift_changed",
  ShiftUnassigned = "shift_unassigned",
  SwapRequested = "swap_requested",
  SwapResolved = "swap_resolved",
  DropAvailable = "drop_available",
  SchedulePublished = "schedule_published",
  OvertimeWarning = "overtime_warning",
  AvailabilityChanged = "availability_changed",
  ApprovalNeeded = "approval_needed",
}

export enum NotificationChannel {
  InApp = "in_app",
  InAppAndEmailSim = "in_app_and_email_sim",
}

export enum AvailabilityType {
  Recurring = "recurring",
  Exception = "exception",
}

export enum ConstraintRule {
  DoubleBooking = "DOUBLE_BOOKING",
  MinRest = "MIN_REST",
  SkillMismatch = "SKILL_MISMATCH",
  NotCertified = "NOT_CERTIFIED",
  OutsideAvailability = "OUTSIDE_AVAILABILITY",
  DailyHoursHardBlock = "DAILY_HOURS_HARD_BLOCK",
  SeventhConsecutiveDay = "SEVENTH_CONSECUTIVE_DAY",
}

export enum ConstraintWarning {
  ApproachingWeekly40 = "APPROACHING_WEEKLY_40",
  DailyOver8 = "DAILY_OVER_8",
  SixthConsecutiveDay = "SIXTH_CONSECUTIVE_DAY",
}

export enum AuditEntityType {
  Shift = "shift",
  Assignment = "assignment",
  SwapRequest = "swap_request",
  Certification = "certification",
}

export enum AuditAction {
  Create = "create",
  Update = "update",
  Cancel = "cancel",
  Publish = "publish",
  Unpublish = "unpublish",
  Approve = "approve",
  Deny = "deny",
  AutoCancel = "auto_cancel",
  Expire = "expire",
  Withdraw = "withdraw",
  Revoke = "revoke",
}
