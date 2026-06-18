"use client"

import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, X, List, LayoutGrid, CalendarDays } from "lucide-react"
import { useDatabaseTodos } from "@/hooks/use-db-tasks"
import { AnalyticsSection } from "./analytics-section"
import { StatusStrip } from "./status-strip"
import { PillFilters, type FilterType, type FilterCounts } from "./pill-filters"
import { EnhancedTaskCard } from "./enhanced-task-card"
import { AddTaskModal } from "./add-task-modal"
import { EditTaskModal } from "./edit-task-modal"
import { FloatingActionButton } from "./floating-action-button"
import { EnhancedEmptyState } from "@/components/enhanced-empty-state"
import { TaskSkeleton } from "@/components/task-skeleton"
import { OnboardingGreeting } from "./onboarding-greeting"
import { WelcomeMessage } from "./welcome-message"
import { QuickCaptureBar } from "./quick-capture-bar"
import { TaskDetailSheet } from "./task-detail-sheet"
import { KanbanBoard } from "./kanban-board"
import { ProcrastinationShield } from "@/components/procrastination/procrastination-shield"
import { CalendarView } from "./calendar-view"
import { BulkActionBar } from "./bulk-action-bar"
import { Input } from "@/components/ui/input"
import type { Task } from "@/lib/types"
import { isSameDay, isAfter, startOfDay, isToday, isTomorrow, isThisWeek } from "date-fns"
import { NotificationService } from "@/lib/services/notifications"

interface ComprehensiveDashboardProps {
  userName?: string
  dbConnected?: boolean
  defaultView?: "list" | "kanban" | "calendar"
}

export function ComprehensiveDashboard({ userName, defaultView }: ComprehensiveDashboardProps) {
  const {
    todos,
    isLoading,
    addTodo,
    updateTodo,
    deleteTodo,
    refetch,
  } = useDatabaseTodos()

  const [mounted, setMounted] = useState(false)
  const [activeFilter, setActiveFilter] = useState<FilterType>("all")
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [duplicateTaskData, setDuplicateTaskData] = useState<{
    title?: string
    description?: string
    priority?: Task["priority"]
    subtasks?: Task["subtasks"]
    duplicatedFromTaskId?: string
  } | null>(null)
  const [isFiltering, setIsFiltering] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [view, setView] = useState<"list" | "kanban" | "calendar">(defaultView ?? "list")
  const [detailTask, setDetailTask] = useState<Task | null>(null)
  const [detailSheetOpen, setDetailSheetOpen] = useState(false)
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set())
  const selectionMode = selectedTasks.size > 0
  const [shieldTask, setShieldTask] = useState<Task | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Keep the open detail sheet in sync with background-polled task data
  useEffect(() => {
    if (!detailTask) return
    const updated = todos.find(t => t.id === detailTask.id)
    if (updated) setDetailTask(updated)
  }, [todos])

  // Listen for service worker notification click events
  useEffect(() => {
    const handleOpenTask = (e: Event) => {
      const taskId = (e as CustomEvent<{ taskId: string }>).detail?.taskId
      if (!taskId || !todos) return
      const task = todos.find(t => t.id === taskId)
      if (task) {
        setDetailTask(task)
        setDetailSheetOpen(true)
      }
    }
    const handleRefresh = () => { refetch() }

    window.addEventListener("tm:open-task", handleOpenTask)
    window.addEventListener("tm:refresh-tasks", handleRefresh)
    return () => {
      window.removeEventListener("tm:open-task", handleOpenTask)
      window.removeEventListener("tm:refresh-tasks", handleRefresh)
    }
  }, [todos, refetch])

  // Initialize notification service
  useEffect(() => {
    if (!mounted || isLoading) return
    
    const notificationService = NotificationService.getInstance()
    
    // Request notification permission
    notificationService.requestNotificationPermission()
    
    // Start monitoring tasks with a function that gets fresh todos
    const cleanup = notificationService.startMonitoring(() => todos || [])
    
    return () => cleanup()
  }, [mounted, isLoading, todos])

  // Check if we should show onboarding after data loads
  useEffect(() => {
    if (!mounted || isLoading) return
    
    // Check if user is new (no tasks) or check URL params for new signup
    const urlParams = new URLSearchParams(window.location.search)
    const isNewSignup = urlParams.get("new") === "true"
    const hasNoTasks = todos && todos.length === 0
    
    // Show onboarding for new signups or users with no tasks (first time)
    if (isNewSignup || hasNoTasks) {
      setShowOnboarding(true)
      // Clean up URL param if present
      if (isNewSignup) {
        window.history.replaceState({}, '', '/dashboard')
      }
    }
  }, [mounted, isLoading, todos])

  // Handle filter change with smooth transition
  const handleFilterChange = (filter: FilterType) => {
    if (filter === activeFilter) return
    
    setIsFiltering(true)
    
    // Small delay to show transition state
    setTimeout(() => {
      setActiveFilter(filter)
      setTimeout(() => {
        setIsFiltering(false)
      }, 300)
    }, 50)
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt+N: New task
      if (e.altKey && e.key === "n") {
        e.preventDefault()
        setShowAddModal(true)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Apply search query across title, description, category, tags, notes
  const searchFilteredTasks = useMemo(() => {
    if (!todos) return []
    if (!searchQuery.trim()) return todos
    const q = searchQuery.toLowerCase()
    return todos.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q) ||
      t.category?.toLowerCase().includes(q) ||
      t.tags?.some(tag => tag.toLowerCase().includes(q)) ||
      t.notes?.toLowerCase().includes(q)
    )
  }, [todos, searchQuery])

  // Live counts for filter pills — derived from search-filtered tasks
  const filterCounts = useMemo((): FilterCounts => {
    const now = new Date()
    const source = searchFilteredTasks
    return {
      all: source.length,
      today: source.filter(t => {
        if (t.startTime) return isSameDay(new Date(t.startTime), new Date())
        if (t.dueDate) return isSameDay(new Date(t.dueDate), new Date())
        return false
      }).length,
      upcoming: source.filter(t => {
        if (t.startTime) return isAfter(startOfDay(new Date(t.startTime)), startOfDay(new Date()))
        if (t.dueDate) return isAfter(startOfDay(new Date(t.dueDate)), startOfDay(new Date()))
        return false
      }).length,
      inProgress: source.filter(t => t.status === "PENDING").length,
      completed: source.filter(t => t.status === "COMPLETED").length,
      overdue: source.filter(t => {
        if (!t.dueDate || t.status === "COMPLETED") return false
        const d = new Date(t.dueDate)
        if (t.dueTime) {
          const [h, m] = t.dueTime.split(":").map(Number)
          d.setHours(h, m, 0, 0)
        } else {
          d.setHours(23, 59, 59, 999)
        }
        return d < now
      }).length,
    }
  }, [searchFilteredTasks])

  // Filter tasks based on active filter
  const filteredTasks = useMemo(() => {
    if (!searchFilteredTasks) return []

    let filtered = [...searchFilteredTasks]

    switch (activeFilter) {
      case "today":
        filtered = filtered.filter(task => {
          // Use startTime for filtering - if task starts today, show it in today
          if (task.startTime) {
            return isSameDay(new Date(task.startTime), new Date())
          }
          // Fallback to dueDate if startTime is not available
          if (task.dueDate) {
            return isSameDay(new Date(task.dueDate), new Date())
          }
          return false
        })
        break
      case "upcoming":
        filtered = filtered.filter(task => {
          // Use startTime for filtering - if task starts after today, show it in upcoming
          if (task.startTime) {
            return isAfter(startOfDay(new Date(task.startTime)), startOfDay(new Date()))
          }
          // Fallback to dueDate if startTime is not available
          if (task.dueDate) {
            return isAfter(startOfDay(new Date(task.dueDate)), startOfDay(new Date()))
          }
          return false
        })
        break
      case "inProgress":
        // In progress = PENDING status (excludes OVERDUE and COMPLETED)
        filtered = filtered.filter(task => task.status === "PENDING")
        break
      case "completed":
        filtered = filtered.filter(task => task.status === "COMPLETED")
        break
      case "overdue":
        filtered = filtered.filter(task => {
          if (!task.dueDate || task.status === "COMPLETED") return false
          const dueDate = new Date(task.dueDate)
          if (task.dueTime) {
            const [hours, minutes] = task.dueTime.split(":").map(Number)
            dueDate.setHours(hours, minutes, 0, 0)
          } else {
            dueDate.setHours(23, 59, 59, 999)
          }
          return dueDate < new Date()
        })
        break
      default:
        // "all" - no filtering
        break
    }

    // Sort tasks by start time (earliest first), with overdue and completed at bottom
    filtered.sort((a, b) => {
      // Helper function to get start time timestamp
      const getStartTimestamp = (task: Task): number => {
        if (task.startTime) {
          return new Date(task.startTime).getTime()
        }
        // Fallback to due date/time if startTime is not available
        if (task.dueDate) {
          const date = new Date(task.dueDate)
          if (task.dueTime) {
            const [hours, minutes] = task.dueTime.split(":").map(Number)
            date.setHours(hours, minutes, 0, 0)
          } else {
            date.setHours(23, 59, 59, 999)
          }
          return date.getTime()
        }
        return 0
      }
      
      // Separate overdue and completed tasks - they go to the bottom
      const aIsOverdueOrCompleted = a.status === "OVERDUE" || a.status === "COMPLETED"
      const bIsOverdueOrCompleted = b.status === "OVERDUE" || b.status === "COMPLETED"
      
      // If one is overdue/completed and the other isn't, overdue/completed goes to bottom
      if (aIsOverdueOrCompleted && !bIsOverdueOrCompleted) return 1
      if (!aIsOverdueOrCompleted && bIsOverdueOrCompleted) return -1
      
      // If both are overdue/completed, sort them by timestamp (most recent first)
      if (aIsOverdueOrCompleted && bIsOverdueOrCompleted) {
        const aTimestamp = getStartTimestamp(a)
        const bTimestamp = getStartTimestamp(b)
        return bTimestamp - aTimestamp // Most recent first
      }
      
      // For active tasks, sort by start time (earliest first)
      // Tasks without start times go to the end (but before overdue/completed)
      const aTimestamp = getStartTimestamp(a)
      const bTimestamp = getStartTimestamp(b)
      
      if (aTimestamp === 0 && bTimestamp === 0) return 0
      if (aTimestamp === 0) return 1
      if (bTimestamp === 0) return -1

      // Sort by start time (earliest first)
      return aTimestamp - bTimestamp
    })

    return filtered
  }, [searchFilteredTasks, activeFilter])

  // Smart date groups — used in list view with "all" filter
  const groupedTasks = useMemo(() => {
    if (activeFilter !== "all" || view !== "list") return null
    const groups: { key: string; label: string; accent: string; tasks: Task[] }[] = [
      { key: "overdue",  label: "Overdue",   accent: "text-red-600 dark:text-red-400",            tasks: [] },
      { key: "today",    label: "Today",     accent: "text-foreground",                            tasks: [] },
      { key: "tomorrow", label: "Tomorrow",  accent: "text-blue-600 dark:text-blue-400",           tasks: [] },
      { key: "week",     label: "This Week", accent: "text-muted-foreground",                      tasks: [] },
      { key: "later",    label: "Later",     accent: "text-muted-foreground",                      tasks: [] },
      { key: "nodate",   label: "No Date",   accent: "text-muted-foreground/60",                   tasks: [] },
      { key: "done",     label: "Done",      accent: "text-accent",                                tasks: [] },
    ]
    for (const task of filteredTasks) {
      if (task.status === "COMPLETED") { groups[6].tasks.push(task); continue }
      if (task.status === "OVERDUE") { groups[0].tasks.push(task); continue }
      const dateStr = task.startTime || task.dueDate
      if (!dateStr) { groups[5].tasks.push(task); continue }
      const d = new Date(dateStr)
      if (isToday(d)) groups[1].tasks.push(task)
      else if (isTomorrow(d)) groups[2].tasks.push(task)
      else if (isThisWeek(d, { weekStartsOn: 1 }) && isAfter(d, new Date())) groups[3].tasks.push(task)
      else if (isAfter(d, new Date())) groups[4].tasks.push(task)
      else groups[5].tasks.push(task) // past but not OVERDUE status
    }
    return groups.filter(g => g.tasks.length > 0)
  }, [filteredTasks, activeFilter, view])

  const handleViewChange = (newView: "list" | "kanban" | "calendar") => {
    setView(newView)
    setSelectedTasks(new Set())
    // Persist list/kanban to DB; calendar is local-only for now
    if (newView !== "calendar") {
      fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultView: newView }),
      }).catch(() => {})
    }
  }

  const handleToggleSelect = (taskId: string) => {
    setSelectedTasks(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  const handleBulkComplete = async () => {
    await Promise.all(
      Array.from(selectedTasks).map(id =>
        updateTodo(id, { status: "COMPLETED", completedAt: new Date().toISOString() })
      )
    )
    setSelectedTasks(new Set())
  }

  const handleBulkDelete = async () => {
    await Promise.all(Array.from(selectedTasks).map(id => deleteTodo(id)))
    setSelectedTasks(new Set())
  }

  const handleBulkReprioritize = async (priority: Task["priority"]) => {
    await Promise.all(Array.from(selectedTasks).map(id => updateTodo(id, { priority })))
    setSelectedTasks(new Set())
  }

  const handleQuickCapture = async (title: string) => {
    const now = new Date()
    const endTime = new Date(now.getTime() + 60 * 60 * 1000)
    await handleAddTask({
      title,
      priority: "MEDIUM",
      status: "PENDING",
      tags: [],
      startTime: now.toISOString(),
      endTime: endTime.toISOString(),
    } as Partial<Task>)
  }

  const handleOpenDetail = (task: Task) => {
    setDetailTask(task)
    setDetailSheetOpen(true)
  }

  const handleAddTask = async (task: Partial<Task>) => {
    const isDuplicate = !!(task as Task).duplicatedFromTaskId
    const newTask = await addTodo(task as Task, isDuplicate ? "Task duplicated successfully" : "Task added successfully")
    
    // Immediately update notification service for the new task
    if (newTask) {
      const notificationService = NotificationService.getInstance()
      notificationService.updateTaskNotifications(newTask)
    }
    
    setDuplicateTaskData(null) // Clear duplicate data after adding
  }

  const handleDuplicateTask = (task: Task) => {
    // Get uncompleted subtasks
    const uncompletedSubtasks = (task.subtasks || []).filter(st => !st.completed)
    
    // Set duplicate data and open add modal
    // Store the original task ID so we can track it
    setDuplicateTaskData({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      subtasks: uncompletedSubtasks.map(st => ({
        id: st.id,
        title: st.title,
        completed: false,
        task_id: ""
      })),
      duplicatedFromTaskId: task.id, // Track which task this was duplicated from
    })
    setShowAddModal(true)
  }

  // Track when duplicated tasks have subtasks completed to auto-mute original
  const handleTaskUpdate = async (id: string, updates: Partial<Task>, successMessage?: string) => {
    // If the due date is being pushed forward, increment defer_count
    const isDeferral = updates.dueDate !== undefined || updates.snoozedUntil !== undefined
    if (isDeferral && updates.status !== "COMPLETED") {
      const task = todos?.find(t => t.id === id)
      if (task) {
        const newDeferCount = (task.deferCount ?? 0) + 1
        updates = { ...updates, deferCount: newDeferCount }
        // Trigger shield if threshold hit
        if (newDeferCount >= 3 && task.status !== "COMPLETED") {
          setShieldTask({ ...task, deferCount: newDeferCount })
        }
      }
    }
    await updateTodo(id, updates, successMessage)
    
    // Immediately update notification service if any notification-related fields changed
    // This includes: time fields (startTime, endTime, dueDate, dueTime), notification settings, or status
    const shouldUpdateNotifications = 
      updates.notificationsMuted !== undefined || 
      updates.snoozedUntil !== undefined ||
      updates.startTime !== undefined ||
      updates.endTime !== undefined ||
      updates.dueDate !== undefined ||
      updates.dueTime !== undefined ||
      updates.notifyOnStart !== undefined ||
      updates.status !== undefined
    
    if (shouldUpdateNotifications) {
      // Use a small delay to ensure state has updated
      setTimeout(() => {
        const updatedTask = todos?.find(t => t.id === id)
        if (updatedTask) {
          const notificationService = NotificationService.getInstance()
          notificationService.updateTaskNotifications(updatedTask)
        }
      }, 200)
    }
    
    // Check if this is a duplicated task with completed subtasks
    // If so, mute notifications on the original task
    if (updates.subtasks && updates.subtasks.length > 0) {
      // Wait a bit for the update to complete, then check
      setTimeout(() => {
        const task = todos?.find(t => t.id === id)
        if (task?.duplicatedFromTaskId) {
          const completedCount = updates.subtasks!.filter(st => st.completed).length
          
          // If at least one subtask is completed, mute the original task
          if (completedCount > 0) {
            const originalTask = todos?.find(t => t.id === task.duplicatedFromTaskId)
            if (originalTask && !originalTask.notificationsMuted && !originalTask.partiallyResolved) {
              updateTodo(originalTask.id, {
                notificationsMuted: true,
                partiallyResolved: true,
              }, "Original task alerts muted (subtasks completed in duplicate)").then(() => {
                // Update notification service for the original task too
                setTimeout(() => {
                  const mutedTask = todos?.find(t => t.id === originalTask.id)
                  if (mutedTask) {
                    const notificationService = NotificationService.getInstance()
                    notificationService.updateTaskNotifications(mutedTask)
                  }
                }, 200)
              })
            }
          }
        }
      }, 200)
    }
  }

  const handleShieldAction = async (action: "break-down" | "clarify" | "reschedule" | "deprioritize" | "delete") => {
    if (!shieldTask) return
    const id = shieldTask.id
    if (action === "break-down") {
      setShieldTask(null)
      setDetailTask(shieldTask)
      setDetailSheetOpen(true)
    } else if (action === "clarify") {
      setShieldTask(null)
      setDetailTask(shieldTask)
      setDetailSheetOpen(true)
    } else if (action === "reschedule") {
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
      await updateTodo(id, { dueDate: tomorrow.toISOString(), procrastinationReason: "reschedule" })
      setShieldTask(null)
    } else if (action === "deprioritize") {
      await updateTodo(id, { priority: "LOW", procrastinationReason: "not-important" })
      setShieldTask(null)
    } else if (action === "delete") {
      await deleteTodo(id)
      setShieldTask(null)
    }
  }

  // Determine if user is new (no tasks)
  const isNewUser = todos && todos.length === 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Onboarding Greeting */}
      {userName && showOnboarding && (
        <OnboardingGreeting
          userName={userName}
          isNewUser={isNewUser}
          onDismiss={() => setShowOnboarding(false)}
        />
      )}

      {/* Main Content */}
      <div className="container mx-auto px-4 pt-24 pb-20 sm:pb-24">
        <div className="space-y-8">
          {/* Welcome Message */}
          {userName && (
            <WelcomeMessage
              userName={userName}
              taskStats={{
                total: (todos || []).length,
                completed: (todos || []).filter(t => t.status === "COMPLETED").length,
                dueToday: (todos || []).filter(t => {
                  if (t.status === "COMPLETED") return false
                  const d = t.startTime || t.dueDate
                  if (!d) return false
                  return isSameDay(new Date(d), new Date())
                }).length,
              }}
            />
          )}

          {/* Status Strip + optional full analytics */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={mounted ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            className="space-y-3"
          >
            <StatusStrip
              tasks={todos || []}
              onToggleAnalytics={() => setShowAnalytics(v => !v)}
              showAnalytics={showAnalytics}
            />
            <AnimatePresence>
              {showAnalytics && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                  className="overflow-hidden"
                >
                  <AnalyticsSection tasks={todos || []} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Search */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={mounted ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
            transition={{ duration: 0.35, delay: 0.08, ease: [0.4, 0, 0.2, 1] }}
            className="relative"
          >
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search tasks, tags, categories…"
              className="pl-10 pr-10 h-11 rounded-xl bg-card/60 border-border/60 focus:border-accent/50 text-sm"
            />
            <AnimatePresence>
              {searchQuery && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 touch-manipulation"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Filters with live counts + view toggle */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={mounted ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
            transition={{ duration: 0.35, delay: 0.13, ease: [0.4, 0, 0.2, 1] }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <PillFilters
                  activeFilter={activeFilter}
                  onFilterChange={handleFilterChange}
                  counts={filterCounts}
                />
              </div>
              {/* View toggle */}
              <div className="flex items-center gap-0.5 flex-shrink-0 p-0.5 rounded-xl bg-muted/60 border border-border/40">
                {([
                  { key: "list", icon: List, label: "List view" },
                  { key: "kanban", icon: LayoutGrid, label: "Kanban view" },
                  { key: "calendar", icon: CalendarDays, label: "Calendar view" },
                ] as const).map(({ key, icon: Icon, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleViewChange(key)}
                    aria-label={label}
                    className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all ${
                      view === key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>

            {/* Quick capture bar — only show on filters where adding new tasks makes sense */}
            {activeFilter !== "overdue" && activeFilter !== "completed" && view === "list" && !selectionMode && (
              <QuickCaptureBar onAdd={handleQuickCapture} disabled={isLoading} />
            )}
            {selectionMode && (
              <p className="text-xs text-muted-foreground text-center py-1">
                Long-press any task to select more. Tap to deselect.
              </p>
            )}
          </motion.div>

          {/* Task List / Kanban with Enhanced Animations */}
          <motion.div
            key={`${activeFilter}-${view}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative"
          >
            {/* Transition Overlay */}
            <AnimatePresence>
              {isFiltering && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-0 bg-background/50 backdrop-blur-sm z-10 rounded-lg pointer-events-none"
                />
              )}
            </AnimatePresence>

            {isLoading ? (
              <TaskSkeleton />
            ) : view === "calendar" ? (
              <CalendarView
                tasks={filteredTasks}
                onAddTask={() => setShowAddModal(true)}
                onOpenDetail={handleOpenDetail}
              />
            ) : view === "kanban" ? (
              <KanbanBoard
                tasks={filteredTasks}
                onUpdate={handleTaskUpdate}
                onCardClick={handleOpenDetail}
              />
            ) : filteredTasks.length > 0 ? (
              <div className="space-y-6">
                {groupedTasks ? (
                  /* Smart Date Groups */
                  groupedTasks.map(group => (
                    <div key={group.key}>
                      <div className="flex items-center gap-2 mb-3 px-0.5">
                        <span className={`text-xs font-bold uppercase tracking-wider ${group.accent}`}>
                          {group.label}
                        </span>
                        <span className="text-[10px] font-semibold text-muted-foreground/50 bg-muted/60 px-1.5 py-0.5 rounded-full">
                          {group.tasks.length}
                        </span>
                        <div className="flex-1 h-px bg-border/30" />
                      </div>
                      <AnimatePresence mode="popLayout">
                        {group.tasks.map((task, index) => (
                          <motion.div
                            key={`group-${task.id}`}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6, transition: { duration: 0.18 } }}
                            transition={{ delay: index * 0.025, duration: 0.22 }}
                            className="mb-2.5"
                          >
                            <EnhancedTaskCard
                              task={task}
                              onUpdate={handleTaskUpdate}
                              onDelete={deleteTodo}
                              onEdit={(t) => { setEditingTask(t); setShowEditModal(true) }}
                              onDuplicate={handleDuplicateTask}
                              onOpenDetail={handleOpenDetail}
                              selected={selectedTasks.has(task.id)}
                              onSelect={handleToggleSelect}
                              selectionMode={selectionMode}
                            />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  ))
                ) : (
                  /* Flat list for filtered views */
                  <motion.div layout className="space-y-3" initial={false}>
                    <AnimatePresence mode="popLayout">
                      {filteredTasks.map((task, index) => (
                        <motion.div
                          key={`${activeFilter}-${task.id}`}
                          layout
                          initial={{ opacity: 0, y: 20, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -10, scale: 0.95, transition: { duration: 0.2 } }}
                          transition={{
                            layout: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
                            opacity: { duration: 0.25 },
                            y: { duration: 0.3 },
                            scale: { duration: 0.25 },
                            delay: index * 0.03
                          }}
                          style={{ originX: 0.5, originY: 0 }}
                        >
                          <EnhancedTaskCard
                            task={task}
                            onUpdate={handleTaskUpdate}
                            onDelete={deleteTodo}
                            onEdit={(t) => { setEditingTask(t); setShowEditModal(true) }}
                            onDuplicate={handleDuplicateTask}
                            onOpenDetail={handleOpenDetail}
                            selected={selectedTasks.has(task.id)}
                            onSelect={handleToggleSelect}
                            selectionMode={selectionMode}
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </motion.div>
                )}
              </div>
            ) : (
              <motion.div
                key={`empty-${activeFilter}`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              >
                <EnhancedEmptyState
                  variant={activeFilter !== "all" ? "filtered" : "tasks"}
                  filterType={activeFilter}
                  onAction={() => setShowAddModal(true)}
                  actionLabel="Create Your First Task"
                />
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Floating Action Button */}
      <FloatingActionButton onClick={() => setShowAddModal(true)} />

      {/* Add Task Modal */}
      <AddTaskModal
        open={showAddModal}
        onOpenChange={(open) => {
          setShowAddModal(open)
          if (!open) setDuplicateTaskData(null) // Clear duplicate data when modal closes
        }}
        onAdd={handleAddTask}
        initialData={duplicateTaskData || undefined}
      />

      {/* Edit Task Modal */}
      <EditTaskModal
        open={showEditModal}
        onOpenChange={(open) => {
          setShowEditModal(open)
          if (!open) setEditingTask(null)
        }}
        task={editingTask}
        onUpdate={updateTodo}
      />

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedTasks.size}
        onCompleteAll={handleBulkComplete}
        onDeleteAll={handleBulkDelete}
        onReprioritize={handleBulkReprioritize}
        onCancel={() => setSelectedTasks(new Set())}
      />

      {/* Task Detail Sheet */}
      <TaskDetailSheet
        task={detailTask}
        open={detailSheetOpen}
        onOpenChange={(open) => {
          setDetailSheetOpen(open)
          if (!open) {
            setTimeout(() => setDetailTask(null), 400)
          }
        }}
        onUpdate={handleTaskUpdate}
      />

      {/* Procrastination Shield */}
      <AnimatePresence>
        {shieldTask && (
          <ProcrastinationShield
            task={shieldTask}
            onDismiss={() => setShieldTask(null)}
            onAction={handleShieldAction}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
