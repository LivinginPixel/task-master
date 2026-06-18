export type TaskStatus = "PENDING" | "COMPLETED" | "OVERDUE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface Task {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: TaskPriority;
  status: TaskStatus;
  tags: string[];
  dueDate: string;
  dueTime: string;
  startTime?: string;
  endTime?: string;
  completedAt?: string;
  overdueAt?: string;
  lockedAfterDue: boolean;
  notificationsMuted?: boolean;
  notifyOnStart?: boolean;
  snoozedUntil?: string;
  partiallyResolved?: boolean;
  duplicatedFromTaskId?: string;
  notes: string;
  recurrenceType?: "daily" | "weekday" | "weekly" | "monthly" | null;
  recurrenceInterval?: number;
  parentTaskId?: string | null;
  shareToken?: string | null;
  deferCount?: number;
  procrastinationReason?: string | null;
  collaboratorCount?: number;
  subtasks?: {
    id: string;
    title: string;
    completed: boolean;
    task_id: string;
  }[];
  attachments?: string[];
  createdAt: string;
  updatedAt?: string;
}


export interface Subtask {
  id: string
  title: string
  completed: boolean
}

export interface TaskFormData extends Omit<Task, 'id' | 'createdAt' | 'attachments'> {
  attachments?: File[]
}