import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "@/lib/db/schema";

type DB = NodePgDatabase<typeof schema>;

// ─── Recurrence helpers ───────────────────────────────────────────────────────

function advanceDate(base: Date, recurrenceType: string, interval: number): Date {
  const next = new Date(base)
  switch (recurrenceType) {
    case "daily":
      next.setDate(next.getDate() + interval)
      break
    case "weekday":
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

// ─── Core function ────────────────────────────────────────────────────────────

/**
 * Update overdue tasks automatically.
 *
 * Recurring tasks (recurrence_type IS NOT NULL):
 *   → Auto-complete when past due and immediately spawn the next occurrence.
 *     They never enter the OVERDUE state — like Google Calendar / Apple Reminders.
 *
 * One-off tasks (recurrence_type IS NULL):
 *   → Marked OVERDUE as usual.
 */
export async function updateOverdueTasks(dbInstance: DB = db) {
  const now = new Date()
  const nowISO = now.toISOString()

  const pastDueCondition = sql`(
    CASE
      WHEN ${tasks.due_time} IS NULL
      THEN ${tasks.due_date} < ${sql.raw(`'${nowISO}'`)}::timestamp
      ELSE (${tasks.due_date}::date + ${tasks.due_time}::time) < ${sql.raw(`'${nowISO}'`)}::timestamp
    END
  )`

  // ── 1. Handle recurring tasks: auto-complete + spawn next ─────────────────
  const pastDueRecurring = await dbInstance
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.status, "PENDING"),
        isNotNull(tasks.due_date),
        isNotNull(tasks.recurrence_type),
        pastDueCondition
      )
    )

  for (const task of pastDueRecurring) {
    const rt = task.recurrence_type!
    const ri = task.recurrence_interval ?? 1

    const nextDue  = advanceDate(task.due_date ?? new Date(), rt, ri)
    const nextStart = task.start_time ? advanceDate(task.start_time, rt, ri) : null
    const nextEnd   = task.end_time   ? advanceDate(task.end_time,   rt, ri) : null

    // Mark this occurrence as silently completed (no "completed" badge needed —
    // it was a scheduled event that has passed).
    await dbInstance
      .update(tasks)
      .set({ status: "COMPLETED", completed_at: now, updated_at: now })
      .where(eq(tasks.id, task.id))

    // Spawn next occurrence
    await dbInstance.insert(tasks).values({
      user_id:            task.user_id,
      title:              task.title,
      description:        task.description,
      notes:              task.notes,
      category:           task.category,
      priority:           task.priority,
      status:             "PENDING",
      tags:               task.tags,
      due_date:           nextDue,
      due_time:           task.due_time,
      start_time:         nextStart,
      end_time:           nextEnd,
      locked_after_due:   false,          // recurring tasks are never locked
      notify_on_start:    task.notify_on_start,
      recurrence_type:    rt,
      recurrence_interval: ri,
      parent_task_id:     task.id,
    })
  }

  // ── 2. Handle one-off tasks: mark OVERDUE as usual ────────────────────────
  const overdueTasks = await dbInstance
    .update(tasks)
    .set({ status: "OVERDUE", overdue_at: now, updated_at: now })
    .where(
      and(
        eq(tasks.status, "PENDING"),
        isNotNull(tasks.due_date),
        sql`${tasks.recurrence_type} IS NULL`,
        pastDueCondition
      )
    )
    .returning()

  return overdueTasks
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Check if a task is locked (overdue and locked_after_due is true).
 * Recurring tasks are never locked even when overdue.
 */
export function isTaskLocked(task: {
  status: string
  locked_after_due: boolean
  recurrence_type?: string | null
}): boolean {
  if (task.recurrence_type) return false          // recurring → never locked
  return task.status === "OVERDUE" && task.locked_after_due
}

/**
 * Validate if a task can be updated.
 * Throws error if task is locked.
 */
export function validateTaskCanBeUpdated(task: {
  status: string
  locked_after_due: boolean
  recurrence_type?: string | null
}): void {
  if (isTaskLocked(task)) {
    throw new Error(
      "This task is locked because it is overdue. Complete or duplicate it instead."
    )
  }
}
