import { NextResponse } from "next/server";
import { getValidatedSession } from "@/lib/validate-session";
import { db } from "@/lib/db";
import { tasks, subtasks } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
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

// GET /api/tasks - Get all tasks the user owns OR is an accepted collaborator on
export async function GET() {
  try {
    const session = await getValidatedSession();
    await updateOverdueTasks();

    // 1. Own tasks with collaborators + subtasks (with assignee + completer info)
    const ownTasks = await db.execute(sql`
      SELECT
        t.*,
        u_completer.name as completed_by_name,
        u_completer.image as completed_by_image,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'id', tc.id,
            'userId', tc.user_id,
            'invitedEmail', tc.invited_email,
            'inviteStatus', tc.invite_status,
            'role', tc.role,
            'name', u_collab.name,
            'image', u_collab.image,
            'acceptedAt', tc.accepted_at
          )) FILTER (WHERE tc.id IS NOT NULL), '[]'
        ) as collaborators,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'id', st.id,
            'title', st.title,
            'completed', st.completed,
            'task_id', st.task_id,
            'assignedTo', st.assigned_to,
            'assigneeName', u_assign.name,
            'assigneeImage', u_assign.image,
            'completedBy', st.completed_by,
            'completedByName', u_st_completer.name,
            'completedByImage', u_st_completer.image,
            'completedAt', st.completed_at
          )) FILTER (WHERE st.id IS NOT NULL), '[]'
        ) as subtasks
      FROM tasks t
      LEFT JOIN users u_completer ON u_completer.id = t.completed_by
      LEFT JOIN task_collaborators tc ON tc.task_id = t.id
      LEFT JOIN users u_collab ON u_collab.id = tc.user_id
      LEFT JOIN subtasks st ON st.task_id = t.id
      LEFT JOIN users u_assign ON u_assign.id = st.assigned_to
      LEFT JOIN users u_st_completer ON u_st_completer.id = st.completed_by
      WHERE t.user_id = ${session.user.id}
      GROUP BY t.id, u_completer.name, u_completer.image
      ORDER BY t.position, t.created_at
    `)

    // 2. Collaborated tasks (tasks owned by others where I'm an accepted collaborator)
    const collabTasks = await db.execute(sql`
      SELECT
        t.*,
        u_owner.name as owner_name,
        u_owner.image as owner_image,
        u_completer.name as completed_by_name,
        u_completer.image as completed_by_image,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'id', tc2.id,
            'userId', tc2.user_id,
            'invitedEmail', tc2.invited_email,
            'inviteStatus', tc2.invite_status,
            'role', tc2.role,
            'name', u_collab2.name,
            'image', u_collab2.image,
            'acceptedAt', tc2.accepted_at
          )) FILTER (WHERE tc2.id IS NOT NULL), '[]'
        ) as collaborators,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'id', st.id,
            'title', st.title,
            'completed', st.completed,
            'task_id', st.task_id,
            'assignedTo', st.assigned_to,
            'assigneeName', u_assign.name,
            'assigneeImage', u_assign.image,
            'completedBy', st.completed_by,
            'completedByName', u_st_completer.name,
            'completedByImage', u_st_completer.image,
            'completedAt', st.completed_at
          )) FILTER (WHERE st.id IS NOT NULL), '[]'
        ) as subtasks
      FROM task_collaborators tc
      JOIN tasks t ON t.id = tc.task_id
      JOIN users u_owner ON u_owner.id = t.user_id
      LEFT JOIN users u_completer ON u_completer.id = t.completed_by
      LEFT JOIN task_collaborators tc2 ON tc2.task_id = t.id
      LEFT JOIN users u_collab2 ON u_collab2.id = tc2.user_id
      LEFT JOIN subtasks st ON st.task_id = t.id
      LEFT JOIN users u_assign ON u_assign.id = st.assigned_to
      LEFT JOIN users u_st_completer ON u_st_completer.id = st.completed_by
      WHERE tc.user_id = ${session.user.id}
        AND tc.invite_status = 'accepted'
        AND t.user_id != ${session.user.id}
      GROUP BY t.id, u_owner.name, u_owner.image, u_completer.name, u_completer.image
      ORDER BY t.created_at
    `)

    const mapRow = (row: Record<string, unknown>, isCollaborated = false) => {
      const base = mapTaskToCamelCase(row)
      return {
        ...base,
        isCollaborated,
        ownerId: row.user_id as string,
        ownerName: isCollaborated ? (row.owner_name as string | null) : null,
        ownerImage: isCollaborated ? (row.owner_image as string | null) : null,
        completedByName: row.completed_by_name as string | null ?? null,
        completedByImage: row.completed_by_image as string | null ?? null,
        collaborators: row.collaborators as unknown[],
        subtasks: (row.subtasks as unknown[]),
      }
    }

    const allTasks = [
      ...ownTasks.rows.map(r => mapRow(r as Record<string, unknown>, false)),
      ...collabTasks.rows.map(r => mapRow(r as Record<string, unknown>, true)),
    ]

    return NextResponse.json(allTasks);
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
