import { NextResponse } from "next/server";
import { getValidatedSession } from "@/lib/validate-session";
import { db } from "@/lib/db";
import { tasks, subtasks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { handleApiError } from "@/lib/errors";
import { mapTaskToCamelCase, isTaskOverdue } from "@/lib/utils";
import { updateOverdueTasks } from "@/lib/task-utils";

const taskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  tags: z.array(z.string()).optional(),
  due_date: z.string().optional(),
  due_time: z.string().optional(),
  start_time: z.string().min(1, "Start time is required"),
  end_time: z.string().min(1, "End time is required"),
  notify_on_start: z.boolean().optional().default(true),
  category: z.string().optional(),
  notes: z.string().optional(),
  attachments: z.array(z.string()).optional(),
  locked_after_due: z.boolean().optional().default(true),
  duplicated_from_task_id: z.string().uuid().optional(),
  recurrence_type: z.enum(["daily", "weekday", "weekly", "monthly"]).nullable().optional(),
  recurrence_interval: z.number().int().min(1).optional().default(1),
  parent_task_id: z.string().uuid().nullable().optional(),
  subtasks: z.array(z.object({
    title: z.string(),
    completed: z.boolean().optional().default(false)
  })).optional(),
});

// GET /api/tasks - Get all tasks for the current user
export async function GET() {
  try {
    const session = await getValidatedSession();

    // First, update any overdue tasks
    await updateOverdueTasks();

    const userTasks = await db.query.tasks.findMany({
      where: eq(tasks.user_id, session.user.id),
      orderBy: [tasks.position, tasks.created_at],
      with: {
        subtasks: true,
      },
    });

    const tasksForFrontend = userTasks.map(mapTaskToCamelCase);

    return NextResponse.json(tasksForFrontend);
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/tasks - Create a new task
export async function POST(req: Request) {
  try {
    const session = await getValidatedSession();

    const json = await req.json();
    // Accept both camelCase and snake_case from frontend
    const body = taskSchema.parse({
      ...json,
      due_date: json.due_date || json.dueDate,
      due_time: json.due_time || json.dueTime,
      start_time: json.start_time || json.startTime,
      end_time: json.end_time || json.endTime,
      notify_on_start: json.notify_on_start !== undefined ? json.notify_on_start : (json.notifyOnStart !== undefined ? json.notifyOnStart : true),
      duplicated_from_task_id: json.duplicated_from_task_id || json.duplicatedFromTaskId,
      recurrence_type: json.recurrence_type ?? json.recurrenceType ?? null,
      recurrence_interval: json.recurrence_interval ?? json.recurrenceInterval ?? 1,
      parent_task_id: json.parent_task_id ?? json.parentTaskId ?? null,
    });

    // Get the current highest position for ordering
    const lastTask = await db.query.tasks.findFirst({
      where: eq(tasks.user_id, session.user.id),
      orderBy: [tasks.position],
      columns: { position: true }
    });

    const position = lastTask ? String(Number(lastTask.position) + 1) : "0";

    // Determine initial status - check if task is already overdue
    let initialStatus: "PENDING" | "COMPLETED" | "OVERDUE" = "PENDING";
    let overdueAt: Date | null = null;
    
    if (body.due_date) {
      const taskToCheck = {
        due_date: new Date(body.due_date),
        due_time: body.due_time || null,
        status: "PENDING" as const,
      };
      if (isTaskOverdue(taskToCheck)) {
        initialStatus = "OVERDUE";
        overdueAt = new Date();
      }
    }

    // Auto-set due_date and due_time from end_time (end_time is required)
    const endDateTime = new Date(body.end_time)
    const dueDate = new Date(endDateTime.getFullYear(), endDateTime.getMonth(), endDateTime.getDate())
    const dueTime = `${String(endDateTime.getHours()).padStart(2, '0')}:${String(endDateTime.getMinutes()).padStart(2, '0')}`

    // Re-check overdue status using end_time as due time
    if (endDateTime) {
      const taskToCheck = {
        due_date: dueDate,
        due_time: dueTime,
        status: "PENDING" as const,
      };
      if (isTaskOverdue(taskToCheck)) {
        initialStatus = "OVERDUE";
        overdueAt = new Date();
      }
    }

    // Insert new task
    const insertedTasks = await db.insert(tasks).values({
      user_id: session.user.id,
      title: body.title,
      description: body.description || "",
      priority: body.priority,
      tags: body.tags || [],
      due_date: dueDate,
      due_time: dueTime,
      start_time: new Date(body.start_time),
      end_time: endDateTime,
      notify_on_start: body.notify_on_start ?? true,
      category: body.category || null,
      notes: body.notes || null,
      attachments: body.attachments || [],
      position,
      status: initialStatus,
      overdue_at: overdueAt,
      locked_after_due: body.locked_after_due ?? true,
      duplicated_from_task_id: body.duplicated_from_task_id || null,
      recurrence_type: body.recurrence_type ?? null,
      recurrence_interval: body.recurrence_interval ?? 1,
      parent_task_id: body.parent_task_id ?? null,
    }).returning();
    
    // Type guard: ensure insertedTasks is an array
    if (!Array.isArray(insertedTasks) || insertedTasks.length === 0) {
      throw new Error("Failed to create task");
    }
    
    const newTask = insertedTasks[0];

    // Insert subtasks if any
    if (body.subtasks?.length) {
      await db.insert(subtasks).values(
        body.subtasks.map(st => ({
          task_id: newTask.id,
          title: st.title,
          completed: st.completed || false,
        }))
      );
    }

    // Fetch and return task with subtasks
    const taskWithSubtasks = await db.query.tasks.findFirst({
      where: eq(tasks.id, newTask.id),
      with: { subtasks: true },
    });

    return NextResponse.json(mapTaskToCamelCase(taskWithSubtasks), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
