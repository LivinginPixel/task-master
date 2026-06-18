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
  // Collaboration
  isCollaborated?: boolean;        // true if this task was shared with me (I'm not the owner)
  ownerId?: string;
  ownerName?: string | null;
  ownerImage?: string | null;
  collaborators?: Collaborator[];
  collaboratorCount?: number;
  subtasks?: {
    id: string;
    title: string;
    completed: boolean;
    task_id: string;
    assignedTo?: string | null;
    assigneeName?: string | null;
    assigneeImage?: string | null;
  }[];
  attachments?: string[];
  createdAt: string;
  updatedAt?: string;
}


export interface Collaborator {
  id: string
  userId: string | null
  invitedEmail: string | null
  inviteStatus: string
  role: string
  name?: string | null
  image?: string | null
  acceptedAt?: string | null
}

export interface Subtask {
  id: string
  title: string
  completed: boolean
  assignedTo?: string | null
  assigneeName?: string | null
  assigneeImage?: string | null
}

export interface TaskFormData extends Omit<Task, 'id' | 'createdAt' | 'attachments'> {
  attachments?: File[]
}