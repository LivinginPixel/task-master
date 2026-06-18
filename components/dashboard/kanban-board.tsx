"use client"

import { useMemo } from "react"
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd"
import { motion } from "framer-motion"
import { format } from "date-fns"
import { Calendar, ListChecks } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Task } from "@/lib/types"

interface KanbanBoardProps {
  tasks: Task[]
  onUpdate: (id: string, updates: Partial<Task>, message?: string) => void
  onCardClick: (task: Task) => void
}

const COLUMNS = [
  { id: "PENDING",   label: "To Do",    accent: "border-blue-400",   badge: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  { id: "OVERDUE",   label: "Overdue",  accent: "border-red-400",    badge: "bg-red-500/10 text-red-700 dark:text-red-300" },
  { id: "COMPLETED", label: "Done",     accent: "border-accent",     badge: "bg-accent/10 text-accent" },
] as const

const PRIORITY_DOT: Record<Task["priority"], string> = {
  URGENT: "bg-red-500",
  HIGH:   "bg-orange-500",
  MEDIUM: "bg-blue-500",
  LOW:    "bg-gray-400",
}

function KanbanCard({ task, index, onClick }: { task: Task; index: number; onClick: () => void }) {
  const subtasks = task.subtasks || []
  const done = subtasks.filter(s => s.completed).length
  const tags = task.tags?.filter(Boolean) ?? []

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className="mb-2.5"
        >
          <motion.div
            animate={snapshot.isDragging ? { scale: 1.02, rotate: 1, boxShadow: "0 20px 40px rgba(0,0,0,0.15)" } : { scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            onClick={onClick}
            className={cn(
              "bg-card border border-border/60 rounded-xl p-3.5 cursor-pointer",
              "hover:border-accent/30 hover:shadow-md transition-all duration-200",
              "relative overflow-hidden",
              snapshot.isDragging && "shadow-xl ring-2 ring-accent/30"
            )}
          >
            {/* Priority accent */}
            <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl", PRIORITY_DOT[task.priority])} />

            <div className="pl-1 space-y-2">
              {/* Title */}
              <p className={cn(
                "text-sm font-semibold text-foreground leading-snug",
                task.status === "COMPLETED" && "line-through text-muted-foreground"
              )}>
                {task.title}
              </p>

              {/* Category + tags */}
              {(task.category || tags.length > 0) && (
                <div className="flex flex-wrap gap-1">
                  {task.category && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {task.category}
                    </span>
                  )}
                  {tags.slice(0, 2).map(tag => (
                    <span key={tag} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Footer: due + subtasks */}
              {(task.dueDate || subtasks.length > 0) && (
                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                  {task.dueDate ? (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(task.dueDate), "MMM d")}
                    </span>
                  ) : <span />}
                  {subtasks.length > 0 && (
                    <span className="flex items-center gap-1">
                      <ListChecks className="h-3 w-3" />
                      <span className="tabular-nums">{done}/{subtasks.length}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </Draggable>
  )
}

export function KanbanBoard({ tasks, onUpdate, onCardClick }: KanbanBoardProps) {
  const columns = useMemo(() => {
    return COLUMNS
      .map(col => ({ ...col, tasks: tasks.filter(t => t.status === col.id) }))
      .filter(col => col.tasks.length > 0)
  }, [tasks])

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    const newStatus = destination.droppableId as Task["status"]
    const updates: Partial<Task> = { status: newStatus }
    if (newStatus === "COMPLETED") {
      updates.completedAt = new Date().toISOString()
    }

    onUpdate(draggableId, updates, newStatus === "COMPLETED" ? "Task completed!" : undefined)
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory">
        {columns.map((col, colIdx) => (
          <motion.div
            key={col.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: colIdx * 0.07, duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="flex-shrink-0 w-[80vw] sm:w-72 snap-start"
          >
            {/* Column header */}
            <div className={cn(
              "flex items-center justify-between px-3.5 py-2.5 mb-3 rounded-xl border-l-4",
              "bg-card/60 border border-border/50",
              col.accent
            )}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">{col.label}</span>
                <span className={cn("text-[11px] font-bold px-1.5 py-0.5 rounded-full", col.badge)}>
                  {col.tasks.length}
                </span>
              </div>
            </div>

            {/* Drop zone */}
            <Droppable droppableId={col.id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    "min-h-[200px] rounded-xl transition-colors duration-200 p-1",
                    snapshot.isDraggingOver && "bg-accent/5 ring-2 ring-accent/20"
                  )}
                >
                  {col.tasks.map((task, idx) => (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      index={idx}
                      onClick={() => onCardClick(task)}
                    />
                  ))}
                  {provided.placeholder}
                  {col.tasks.length === 0 && !snapshot.isDraggingOver && (
                    <div className="flex items-center justify-center h-20 text-xs text-muted-foreground/50 font-medium">
                      Drop tasks here
                    </div>
                  )}
                </div>
              )}
            </Droppable>
          </motion.div>
        ))}
      </div>
    </DragDropContext>
  )
}
