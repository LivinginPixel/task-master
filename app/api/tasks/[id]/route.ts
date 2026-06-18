import { NextResponse } from "next/server";
import { getValidatedSession } from "@/lib/validate-session";
import { db } from "@/lib/db";
import { tasks, subtasks, taskCollaborators } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { mapTaskToCamelCase, isTaskOverdue } from "@/lib/utils";
import { handleApiError } from "@/lib/errors";
import { isTaskLocked } from "@/lib/task-utils";
import { sendTaskPush } from "@/lib/services/push";

/**
 * Advance a date by the recurrence interval, preserving the time-of-day.
 * For "weekday": skip weekends until the next weekday.
 */
function advanceDate(base: Date, recurrenceType: string, interval: number): Date {
  const next = new Date(base)
  switch (recurrenceType) {
    case "daily":
      next.setDate(next.getDate() + interval)
      break
    case "weekday":
      // Always advance at least 1 day then skip past any weekend days
      next.setDate(next.getDate() + 1)
      while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() + 1)
      break
    case "weekly":
      next.setDate(next.getDate() + 7 * interval)
      break
    case "monthly":
      next.setMonth(next.getMonth() + interval)
      break
  }
  return next
}

/**
 * Given the current occurrence's due date, compute the next due date.
 * Falls back to "today → advance" if no due date is set.
 */
function computeNextDueDate(
  currentDue: Date | null,
  recurrenceType: string,
  interval: number
): Date | null {
  if (!recurrenceType) return null
  const base = currentDue ? new Date(currentDue) : new Date()
  return advanceDate(base, recurrenceType, interval)
}

const updateTaskSchema = z.object({
  title: z.string(),
  description: z.string(),
  category: z.string(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  status: z.enum(["PENDING", "COMPLETED", "OVERDUE"]).optional(),
  tags: z.array(z.string()),
  dueTime: z.string(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  notes: z.string(),
  locked_after_due: z.boolean().optional(),
  notificationsMuted: z.boolean().optional(),
  notifications_muted: z.boolean().optional(),
  notifyOnStart: z.boolean().optional(),
  notify_on_start: z.boolean().optional(),
  snoozedUntil: z.string().optional(),
  snoozed_until: z.string().optional(),
  partiallyResolved: z.boolean().optional(),
  partially_resolved: z.boolean().optional(),
  subtasks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    completed: z.boolean(),
    task_id: z.string().optional() // Made task_id optional since we'll set it server-side
  })),
  dueDate: z.string().optional(),
  recurrenceType: z.enum(["daily", "weekday", "weekly", "monthly"]).nullable().optional(),
  recurrenceInterval: z.number().int().min(1).optional(),
  parentTaskId: z.string().nullable().optional(),
  deferCount: z.number().int().min(0).optional(),
  procrastinationReason: z.string().nullable().optional(),
  completedAt: z.string().optional(),
}).partial();

// PATCH /api/tasks/[id] - Update a task
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getValidatedSession();
    const userId = session.user.id;

    const body = await req.json();

    // Add task_id to subtasks before validation
    if (body.subtasks) {
      interface SubtaskInput {
        id: string;
        title: string;
        completed: boolean;
        task_id?: string;
      }

      body.subtasks = (body.subtasks as SubtaskInput[]).map((subtask: SubtaskInput) => ({
        ...subtask,
        task_id: params.id
      }));
    }

    // Get current task — owner OR accepted collaborator can update
    const currentTask = await db.query.tasks.findFirst({
      where: eq(tasks.id, params.id),
    });

    if (!currentTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const isOwner = currentTask.user_id === userId
    if (!isOwner) {
      const [collab] = await db.select({ id: taskCollaborators.id })
        .from(taskCollaborators)
        .where(and(
          eq(taskCollaborators.task_id, params.id),
          eq(taskCollaborators.user_id, userId),
          eq(taskCollaborators.invite_status, "accepted")
        )).limit(1)
      if (!collab) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Check if task is locked (overdue and locked_after_due is true)
    // Allow status change to COMPLETED even if locked
    const isCompleting = body.status === "COMPLETED" && currentTask.status !== "COMPLETED";
    const isLocked = isTaskLocked({
      status: currentTask.status,
      locked_after_due: currentTask.locked_after_due ?? true
    });
    
    // If locked and not completing, block ALL edits except status change to COMPLETED
    // Also allow notification controls (mute/snooze) even for locked tasks
    if (isLocked && !isCompleting) {
      // Check if trying to edit any fields other than status or notification controls
      const notificationControls = 
        body.notificationsMuted !== undefined ||
        body.notifications_muted !== undefined ||
        body.snoozedUntil !== undefined ||
        body.snoozed_until !== undefined ||
        body.partiallyResolved !== undefined ||
        body.partially_resolved !== undefined;
      
      const hasEdits = 
        body.title !== undefined ||
        body.description !== undefined ||
        body.category !== undefined ||
        body.priority !== undefined ||
        body.tags !== undefined ||
        body.dueDate !== undefined ||
        body.dueTime !== undefined ||
        body.notes !== undefined ||
        body.subtasks !== undefined ||
        body.locked_after_due !== undefined;
      
      // Block edits but allow notification controls
      if (hasEdits && !notificationControls) {
        return NextResponse.json(
          { 
            error: "This task is locked because it is overdue. Complete or duplicate it instead.",
            code: "TASK_LOCKED"
          },
          { status: 403 }
        );
      }
    }

    const validatedData = updateTaskSchema.parse(body);

    // Prepare update data
    const now = new Date();
    const updateData: any = {
      updated_at: now,
    };

    // Map camelCase fields to snake_case for database
    if (validatedData.title !== undefined) {
      updateData.title = validatedData.title;
    }
    if (validatedData.description !== undefined) {
      updateData.description = validatedData.description;
    }
    if (validatedData.category !== undefined) {
      updateData.category = validatedData.category;
    }
    if (validatedData.priority !== undefined) {
      updateData.priority = validatedData.priority;
    }
    if (validatedData.tags !== undefined) {
      updateData.tags = validatedData.tags;
    }
    if (validatedData.notes !== undefined) {
      updateData.notes = validatedData.notes;
    }
    if (validatedData.locked_after_due !== undefined) {
      updateData.locked_after_due = validatedData.locked_after_due;
    }
    if (validatedData.dueDate !== undefined) {
      updateData.due_date = validatedData.dueDate ? new Date(validatedData.dueDate) : null;
    }
    if (validatedData.dueTime !== undefined) {
      updateData.due_time = validatedData.dueTime || null;
    }
    if (validatedData.startTime !== undefined) {
      updateData.start_time = validatedData.startTime ? new Date(validatedData.startTime) : null;
    }
    if (validatedData.endTime !== undefined) {
      const endDateTime = new Date(validatedData.endTime);
      updateData.end_time = endDateTime;
      // Auto-set due_date and due_time from end_time
      updateData.due_date = new Date(endDateTime.getFullYear(), endDateTime.getMonth(), endDateTime.getDate());
      updateData.due_time = `${String(endDateTime.getHours()).padStart(2, '0')}:${String(endDateTime.getMinutes()).padStart(2, '0')}`;
    }

    // Map camelCase to snake_case for new notification fields
    if (validatedData.notificationsMuted !== undefined) {
      updateData.notifications_muted = validatedData.notificationsMuted;
      delete updateData.notificationsMuted;
    }
    if (validatedData.notifications_muted !== undefined) {
      updateData.notifications_muted = validatedData.notifications_muted;
    }
    // Handle notifyOnStart - check both camelCase and snake_case
    if (validatedData.notifyOnStart !== undefined) {
      updateData.notify_on_start = validatedData.notifyOnStart;
      delete updateData.notifyOnStart;
    }
    if (validatedData.notify_on_start !== undefined) {
      updateData.notify_on_start = validatedData.notify_on_start;
    }
    // Handle snoozedUntil - check both camelCase and snake_case, and handle null/undefined explicitly
    if (validatedData.snoozedUntil !== undefined || body.snoozedUntil !== undefined) {
      const snoozeValue = validatedData.snoozedUntil !== undefined ? validatedData.snoozedUntil : body.snoozedUntil;
      updateData.snoozed_until = snoozeValue ? new Date(snoozeValue) : null;
      delete updateData.snoozedUntil;
    }
    if (validatedData.snoozed_until !== undefined || body.snoozed_until !== undefined) {
      const snoozeValue = validatedData.snoozed_until !== undefined ? validatedData.snoozed_until : body.snoozed_until;
      updateData.snoozed_until = snoozeValue ? new Date(snoozeValue) : null;
    }
    if (validatedData.partiallyResolved !== undefined) {
      updateData.partially_resolved = validatedData.partiallyResolved;
      delete updateData.partiallyResolved;
    }
    if (validatedData.partially_resolved !== undefined) {
      updateData.partially_resolved = validatedData.partially_resolved;
    }
    if (validatedData.recurrenceType !== undefined) {
      updateData.recurrence_type = validatedData.recurrenceType;
    }
    if (validatedData.recurrenceInterval !== undefined) {
      updateData.recurrence_interval = validatedData.recurrenceInterval;
    }
    if (validatedData.parentTaskId !== undefined) {
      updateData.parent_task_id = validatedData.parentTaskId;
    }
    if (validatedData.deferCount !== undefined) {
      updateData.defer_count = validatedData.deferCount;
    }
    if (validatedData.procrastinationReason !== undefined) {
      updateData.procrastination_reason = validatedData.procrastinationReason;
    }

    // Handle status transitions according to specification
    if (validatedData.status !== undefined) {
      const newStatus = validatedData.status;
      const oldStatus = currentTask.status;
      
      updateData.status = newStatus;

      // PENDING → COMPLETED: set completed_at, clear overdue_at
      if (oldStatus === "PENDING" && newStatus === "COMPLETED") {
        updateData.completed_at = now;
        updateData.overdue_at = null;
      }
      // OVERDUE → COMPLETED: set completed_at, clear overdue_at
      else if (oldStatus === "OVERDUE" && newStatus === "COMPLETED") {
        updateData.completed_at = now;
        updateData.overdue_at = null;
      }
      // COMPLETED → PENDING: clear completed_at, clear overdue_at if any
      else if (oldStatus === "COMPLETED" && newStatus === "PENDING") {
        updateData.completed_at = null;
        updateData.overdue_at = null;
      }
      // OVERDUE → PENDING: clear overdue_at (when due_date extended)
      else if (oldStatus === "OVERDUE" && newStatus === "PENDING") {
        updateData.overdue_at = null;
      }
      // PENDING → OVERDUE: set overdue_at (should be automatic, but handle manual case)
      else if (oldStatus === "PENDING" && newStatus === "OVERDUE") {
        updateData.overdue_at = now;
      }
    }

    // Auto-update status based on due date if dueDate or dueTime changed
    // Only allow this if task is not locked (locked tasks can't edit due dates)
    if (!isLocked && (validatedData.dueDate !== undefined || validatedData.dueTime !== undefined)) {
      const taskToCheck = {
        due_date: validatedData.dueDate ? new Date(validatedData.dueDate) : currentTask.due_date,
        due_time: validatedData.dueTime !== undefined ? validatedData.dueTime : currentTask.due_time,
        status: validatedData.status || currentTask.status,
      };

      // Only auto-update if status wasn't explicitly set to COMPLETED
      if (updateData.status !== "COMPLETED") {
        if (isTaskOverdue(taskToCheck)) {
          updateData.status = "OVERDUE";
          updateData.overdue_at = now;
        } else if (taskToCheck.due_date) {
          // If not overdue and has due date, set to PENDING
          updateData.status = "PENDING";
          updateData.overdue_at = null;
        }
      }
    }
    
    // Block editing other fields when locked (except status change to COMPLETED and notification controls)
    if (isLocked && !isCompleting) {
      // Remove all fields except status and notification controls from updateData
      const allowedFields = [
        'status', 
        'updated_at',
        'notifications_muted',
        'snoozed_until',
        'partially_resolved'
      ];
      Object.keys(updateData).forEach(key => {
        if (!allowedFields.includes(key)) {
          delete updateData[key];
        }
      });
    }

    // Only update if there are fields to update (besides updated_at)
    const fieldsToUpdate = Object.keys(updateData).filter(key => key !== 'updated_at');
    if (fieldsToUpdate.length > 0) {
      await db
        .update(tasks)
        .set(updateData)
        .where(and(eq(tasks.id, params.id), eq(tasks.user_id, userId)));
    }

    // Handle subtasks update if present
    // Subtasks can always be edited on overdue tasks (matching ClickUp/Todoist behaviour).
    // Only COMPLETED tasks lock their subtasks (enforced on the client side).
    if (validatedData.subtasks !== undefined) {
      // Remove old subtasks for this task
      await db.delete(subtasks).where(eq(subtasks.task_id, params.id));
      // Insert new subtasks
      if (validatedData.subtasks.length > 0) {
        await db.insert(subtasks).values(validatedData.subtasks.map(st => ({
          ...st,
          task_id: params.id
        })));
      }
    }

    const updatedTask = await db.query.tasks.findFirst({
      where: eq(tasks.id, params.id),
      with: { subtasks: true }
    });

    // Auto-create next recurrence when completing a recurring task
    if (isCompleting && currentTask.recurrence_type) {
      const rt = currentTask.recurrence_type
      const ri = currentTask.recurrence_interval ?? 1

      const nextDue = computeNextDueDate(currentTask.due_date, rt, ri)

      // Advance start_time and end_time by the same calendar distance
      const nextStart = currentTask.start_time ? advanceDate(currentTask.start_time, rt, ri) : null
      const nextEnd = currentTask.end_time ? advanceDate(currentTask.end_time, rt, ri) : null

      if (nextDue) {
        await db.insert(tasks).values({
          user_id: userId,
          title: currentTask.title,
          description: currentTask.description,
          notes: currentTask.notes,
          category: currentTask.category,
          priority: currentTask.priority,
          status: "PENDING",
          tags: currentTask.tags,
          due_date: nextDue,
          due_time: currentTask.due_time,
          start_time: nextStart,
          end_time: nextEnd,
          locked_after_due: currentTask.locked_after_due,
          notify_on_start: currentTask.notify_on_start,
          recurrence_type: rt,
          recurrence_interval: ri,
          parent_task_id: currentTask.id,
        })
      }
    }

    if (!updatedTask) return NextResponse.json({ error: "Task not found after update" }, { status: 404 })

    // Notify accepted collaborators that the task was updated
    const collabs = await db.select({ user_id: taskCollaborators.user_id })
      .from(taskCollaborators)
      .where(and(
        eq(taskCollaborators.task_id, params.id),
        eq(taskCollaborators.invite_status, "accepted")
      ))
    for (const c of collabs) {
      if (c.user_id && c.user_id !== session.user.id) {
        sendTaskPush(c.user_id, "completed", updatedTask.title, updatedTask.id).catch(() => {})
      }
    }

    return NextResponse.json(mapTaskToCamelCase(updatedTask));
  } catch (error) {

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks/[id] - Delete a task
export async function DELETE(
  _: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getValidatedSession();
    const userId = session.user.id;

    // Optionally, delete subtasks first if not using ON DELETE CASCADE
    await db.delete(subtasks).where(eq(subtasks.task_id, params.id));

    // Delete the task
    const deleted = await db
      .delete(tasks)
      .where(and(eq(tasks.id, params.id), eq(tasks.user_id, userId)))
      .returning();

    if (Array.isArray(deleted) && deleted.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}