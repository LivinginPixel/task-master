import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Map database task fields to camelCase for frontend
 */
export function mapTaskToCamelCase(task: any) {
  return {
    ...task,
    dueDate: task.due_date,
    dueTime: task.due_time,
    startTime: task.start_time,
    endTime: task.end_time,
    completedAt: task.completed_at,
    overdueAt: task.overdue_at,
    lockedAfterDue: task.locked_after_due ?? true,
    notificationsMuted: task.notifications_muted ?? false,
    notifyOnStart: task.notify_on_start ?? true,
    snoozedUntil: task.snoozed_until,
    partiallyResolved: task.partially_resolved ?? false,
    duplicatedFromTaskId: task.duplicated_from_task_id,
    recurrenceType: task.recurrence_type ?? null,
    recurrenceInterval: task.recurrence_interval ?? 1,
    parentTaskId: task.parent_task_id ?? null,
    shareToken: task.share_token ?? null,
    deferCount: task.defer_count ?? 0,
    procrastinationReason: task.procrastination_reason ?? null,
    isCollaborated: task.isCollaborated ?? false,
    ownerId: task.user_id,
    ownerName: task.owner_name ?? null,
    ownerImage: task.owner_image ?? null,
    completedByName: task.completed_by_name ?? null,
    completedByImage: task.completed_by_image ?? null,
    collaborators: task.collaborators ?? [],
  }
}

/**
 * Check if a task is overdue based on due_date and due_time
 */
export function isTaskOverdue(task: { 
  due_date: Date | null; 
  due_time: string | null; 
  status?: string;
}): boolean {
  if (!task.due_date || task.status === "COMPLETED") {
    return false;
  }

  const dueDate = new Date(task.due_date);
  if (task.due_time) {
    const [hours, minutes] = task.due_time.split(":").map(Number);
    dueDate.setHours(hours, minutes, 0, 0);
  } else {
    dueDate.setHours(23, 59, 59, 999);
  }

  return dueDate < new Date();
}

/**
 * Calculate time remaining until due date/time
 * Returns milliseconds until due, or negative if overdue
 */
export function getTimeUntilDue(task: { 
  due_date: Date | null; 
  due_time: string | null;
}): number | null {
  if (!task.due_date) return null;

  const dueDate = new Date(task.due_date);
  if (task.due_time) {
    const [hours, minutes] = task.due_time.split(":").map(Number);
    dueDate.setHours(hours, minutes, 0, 0);
  } else {
    dueDate.setHours(23, 59, 59, 999);
  }

  return dueDate.getTime() - new Date().getTime();
}

/**
 * Get task health status based on time until due
 * Returns: "healthy" | "at_risk" | "critical"
 */
export function getTaskHealthStatus(task: {
  due_date: Date | null;
  due_time: string | null;
  status?: string;
}): "healthy" | "at_risk" | "critical" | null {
  if (!task.due_date || task.status === "COMPLETED") return null;

  const timeUntilDue = getTimeUntilDue(task);
  if (timeUntilDue === null) return null;

  const hoursUntilDue = timeUntilDue / (1000 * 60 * 60);

  if (timeUntilDue < 0) {
    return "critical"; // Already overdue
  } else if (hoursUntilDue <= 1) {
    return "critical"; // Less than 1 hour
  } else if (hoursUntilDue <= 3) {
    return "at_risk"; // Less than 3 hours
  } else if (hoursUntilDue <= 24) {
    return "at_risk"; // Less than 24 hours
  } else {
    return "healthy";
  }
}

/**
 * Format time remaining as human-readable string
 */
export function formatTimeRemaining(ms: number): string {
  if (ms < 0) {
    const overdue = Math.abs(ms);
    const hours = Math.floor(overdue / (1000 * 60 * 60));
    const minutes = Math.floor((overdue % (1000 * 60 * 60)) / (1000 * 60));
    return `Overdue by ${hours}h ${minutes}m`;
  }

  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}
