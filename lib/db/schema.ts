import { relations } from "drizzle-orm";
import { pgTable, uuid, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";

// Define priority enum values
export const TaskPriority = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  URGENT: "URGENT",
} as const;

export type TaskPriorityType = typeof TaskPriority[keyof typeof TaskPriority];

// Define task status enum values
export const TaskStatus = {
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
  OVERDUE: "OVERDUE",
} as const;

export type TaskStatusType = typeof TaskStatus[keyof typeof TaskStatus];

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").unique().notNull(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  hashed_password: text("hashed_password"),
  avatar_url: text("avatar_url"),
  notifications_enabled: boolean("notifications_enabled").default(true),
  default_view: text("default_view").default("list"),
  theme: text("theme").default("light"),
  reset_password_token: text("reset_password_token"),
  reset_password_expires: timestamp("reset_password_expires", { mode: "date" }),
  email_verification_token: text("email_verification_token"),
  email_verification_expires: timestamp("email_verification_expires", { mode: "date" }),
  failed_login_attempts: text("failed_login_attempts").default("0"),
  locked_until: timestamp("locked_until", { mode: "date" }),
  created_at: timestamp("created_at").defaultNow().notNull()
});

export const tasks = pgTable('tasks', {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  notes: text("notes"), 
  due_date: timestamp("due_date", { mode: "date" }),
  due_time: text("due_time"),
  start_time: timestamp("start_time", { mode: "date" }),
  end_time: timestamp("end_time", { mode: "date" }),
  priority: text("priority", { enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] }).notNull().default("LOW"),
  category: text("category"),
  status: text("status", { enum: ["PENDING", "COMPLETED", "OVERDUE"] }).notNull().default("PENDING"),
  completed_at: timestamp("completed_at", { mode: "date" }),
  completed_by: uuid("completed_by").references(() => users.id, { onDelete: "set null" }),
  overdue_at: timestamp("overdue_at", { mode: "date" }),
  locked_after_due: boolean("locked_after_due").default(true).notNull(),
  notifications_muted: boolean("notifications_muted").default(false).notNull(),
  notify_on_start: boolean("notify_on_start").default(true).notNull(),
  snoozed_until: timestamp("snoozed_until", { mode: "date" }),
  partially_resolved: boolean("partially_resolved").default(false).notNull(),
  duplicated_from_task_id: uuid("duplicated_from_task_id"),
  tags: text("tags").array(),
  position: text("position"),
  attachments: text("attachments").array(),
  recurrence_type: text("recurrence_type"),
  recurrence_interval: integer("recurrence_interval").default(1),
  parent_task_id: uuid("parent_task_id"),
  share_token: text("share_token").unique(),
  defer_count: integer("defer_count").default(0).notNull(),
  procrastination_reason: text("procrastination_reason"),
  archived: boolean("archived").default(false).notNull(),
  archived_at: timestamp("archived_at"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const subtasks = pgTable('subtasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  completed: boolean('completed').default(false).notNull(),
  task_id: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  assigned_to: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
  completed_by: uuid('completed_by').references(() => users.id, { onDelete: 'set null' }),
  completed_at: timestamp('completed_at'),
  position: integer('position').default(0),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Define relations
export const usersRelations = relations(users, ({ many }) => ({
  tasks: many(tasks)
}));

export const tasksRelations = relations(tasks, ({ many }) => ({
  subtasks: many(subtasks),
}));

export const subtasksRelations = relations(subtasks, ({ one }) => ({
  task: one(tasks, {
    fields: [subtasks.task_id],
    references: [tasks.id],
  }),
}));

export const taskCollaborators = pgTable("task_collaborators", {
  id: uuid("id").primaryKey().defaultRandom(),
  task_id: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  user_id: uuid("user_id").references(() => users.id, { onDelete: "cascade" }), // null until accepted
  invited_email: text("invited_email"),
  invite_token: text("invite_token").unique(),
  invite_status: text("invite_status").default("pending"), // pending | accepted | declined
  role: text("role").default("collaborator"),
  invited_at: timestamp("invited_at").defaultNow(),
  accepted_at: timestamp("accepted_at"),
});

// Auth tables - using snake_case column names to match DrizzleAdapter expectations
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("providerAccountId").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state")
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sessionToken: text("sessionToken").unique().notNull(),
  expires: timestamp("expires").notNull()
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires").notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type SubTask = typeof subtasks.$inferSelect;
export type NewSubTask = typeof subtasks.$inferInsert;