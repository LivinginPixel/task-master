"use client"

import { useState, useEffect, useMemo } from "react"
import { useSession } from "next-auth/react"
import type { Task } from "../lib/types"
import { useToast } from "@/components/ui/use-toast"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"

// Replace localStorage operations with API interactions
export function useDatabaseTodos() {
  const [todos, setTodos] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const { toast } = useToast()
  const { data: session } = useSession()

  // Active (non-archived) tasks — the main working set
  const activeTodos = useMemo(() => todos.filter(t => !t.archived), [todos])

  // Calculate statistics (only over non-archived tasks)
  const stats = useMemo(() => {
    const now = new Date()
    const total = activeTodos.length
    const completed = activeTodos.filter((todo) => todo.status === "COMPLETED").length
    const pending = total - completed
    const overdue = activeTodos.filter((todo) => {
      if (todo.status === "COMPLETED") return false
      // Prefer endTime (UTC) for timezone-safe check
      if (todo.endTime) return new Date(todo.endTime) < now
      if (!todo.dueDate) return false
      const d = new Date(todo.dueDate)
      if (todo.dueTime) {
        const [h, m] = todo.dueTime.split(":").map(Number)
        d.setHours(h, m, 0, 0)
      } else {
        d.setHours(23, 59, 59, 999)
      }
      return d < now
    }).length
    const dueToday = activeTodos.filter((todo) => {
      if (!todo.dueDate || todo.status === "COMPLETED") return false
      const deadline = todo.endTime ? new Date(todo.endTime) : new Date(todo.dueDate)
      const today = new Date()
      return (
        deadline.getDate() === today.getDate() &&
        deadline.getMonth() === today.getMonth() &&
        deadline.getFullYear() === today.getFullYear()
      )
    }).length

    return { total, completed, pending, overdue, dueToday }
  }, [activeTodos])

  // Fetch todos from database
  const fetchTodos = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/tasks")
      if (!response.ok) throw new Error("Failed to fetch todos")

      const data = await response.json()
      setTodos(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load todos"))
      toast({
        title: "Error",
        description: "Failed to load todos",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Add a new task to the database
  const addTodo = async (todo: Task, successMessage?: string): Promise<Task | null> => {
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(todo),
      })
      if (!response.ok) throw new Error("Failed to add todo")

      const newTodo = await response.json()
      setTodos((prevTodos) => [...prevTodos, newTodo])

      const message = successMessage || (todo.duplicatedFromTaskId ? "Task duplicated successfully" : "Task added successfully")
      
      toast({
        title: "Success",
        description: message,
      })
      
      return newTodo
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to add todo"))
      toast({
        title: "Error",
        description: "Failed to add task",
        variant: "destructive",
      })
      return null
    }
  }

  // Update an existing task in the database
  const updateTodo = async (id: string, updates: Partial<Task>, successMessage?: string) => {
    // Optimistic update — reflect change immediately in the UI
    let previousTask: Task | undefined
    setTodos((prevTodos) => {
      previousTask = prevTodos.find(t => t.id === id)
      return prevTodos.map((todo) =>
        todo.id === id ? { ...todo, ...updates } : todo
      )
    })

    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update task");
      }

      const updatedTodo = await response.json();

      // Replace optimistic state with authoritative server response
      setTodos((prevTodos) =>
        prevTodos.map((todo) => (todo.id === id ? updatedTodo : todo))
      );

      // Determine the success message based on what was updated
      // Priority: explicit message > status change > notification controls > subtasks > generic
      let message = successMessage || "Task updated successfully";
      
      if (!successMessage) {
        // Check status changes first (most important user action)
        if (updates.status === "COMPLETED") {
          message = "Task completed successfully";
        } else if (updates.status === "PENDING" && updates.completedAt === null) {
          // Only show "reopened" if we're clearing completed_at (not just setting status)
          message = "Task reopened successfully";
        } else if (updates.status === "OVERDUE") {
          message = "Task marked as overdue";
        } 
        // Then check notification controls (only if status didn't change)
        else if (updates.notificationsMuted !== undefined) {
          message = updates.notificationsMuted 
            ? "Notifications muted successfully" 
            : "Notifications unmuted successfully";
        } else if (updates.snoozedUntil !== undefined) {
          if (updates.snoozedUntil === null || updates.snoozedUntil === undefined) {
            message = "Snooze cleared - notifications reactivated";
          } else {
            message = "Notifications snoozed successfully";
          }
        } else if (updates.partiallyResolved !== undefined) {
          message = updates.partiallyResolved
            ? "Task marked as partially resolved"
            : "Partially resolved status cleared";
        } 
        // Then check subtasks (only if nothing else matched)
        else if (updates.subtasks !== undefined) {
          message = "Subtasks updated successfully";
        }
      }

      toast({
        title: "Success",
        description: message,
      });
    } catch (err) {
      // Revert optimistic update on failure
      if (previousTask) {
        setTodos((prevTodos) =>
          prevTodos.map((todo) => (todo.id === id ? previousTask! : todo))
        )
      }
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update task",
        variant: "destructive",
      });
    }
  }

  // Delete a task from the database
  const deleteTodo = async (id: string) => {
    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("Failed to delete todo")

      setTodos((prevTodos) => prevTodos.filter((todo) => todo.id !== id))

      toast({
        title: "Task deleted",
        description: "Your task has been deleted",
      })
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to delete todo"))
      toast({
        title: "Error",
        description: "Failed to delete task",
        variant: "destructive",
      })
    }
  }

  // Clear all tasks (dangerous action) - optimized with batch delete
  const clearAllTodos = async () => {
    try {
      if (todos.length === 0) return;

      // Batch delete all tasks in a single request
      const taskIds = todos.map((todo) => todo.id);
      const response = await fetch("/api/tasks/batch-delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds }),
      });

      if (!response.ok) {
        throw new Error("Failed to clear all tasks");
      }

      setTodos([]);

      toast({
        title: "All tasks cleared",
        description: "All your tasks have been deleted",
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to clear todos"));
      toast({
        title: "Error",
        description: "Failed to clear tasks",
        variant: "destructive",
      });
    }
  }

  // Reorder tasks
  const reorderTodos = async (orderedIds: string[]) => {
    try {
      // Optimistically update local state
      const reorderedTodos = orderedIds
        .map((id) => todos.find((todo) => todo.id === id))
        .filter((todo): todo is Task => todo != null)

      setTodos(reorderedTodos)

      // Persist to database
      const items = orderedIds.map((id, index) => ({
        id,
        position: index
      }))

      const response = await fetch("/api/tasks/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      })

      if (!response.ok) {
        // Revert on error
        setTodos(todos)
        throw new Error("Failed to reorder tasks")
      }
    } catch (err) {
      // Revert to original order on error
      setTodos(todos)
      setError(err instanceof Error ? err : new Error("Failed to reorder todos"))
      toast({
        title: "Error",
        description: "Failed to reorder tasks",
        variant: "destructive",
      })
    }
  }

  // Sort tasks based on a field
  const sortTodos = (by: "dueDate" | "priority" | "createdAt") => {
    try {
      const sortedTodos = [...todos].sort((a, b) => {
        if (by === "dueDate") {
          if (!a.dueDate) return 1
          if (!b.dueDate) return -1
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
        }

        if (by === "priority") {
          const priorities = { urgent: 4, high: 3, medium: 2, low: 1 }
          const aPriority = priorities[a.priority as keyof typeof priorities] || 0
          const bPriority = priorities[b.priority as keyof typeof priorities] || 0
          return bPriority - aPriority
        }

        // Default to createdAt if no valid field found
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })

      setTodos(sortedTodos)
      toast({
        title: "Tasks sorted",
        description: `Tasks sorted by ${by}`,
      })
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to sort todos"))
      toast({
        title: "Error",
        description: "Failed to sort tasks",
        variant: "destructive",
      })
    }
  }

  // Fetch todos on mount
  useEffect(() => {
    fetchTodos()
  }, [])

  // Real-time sync via Supabase Realtime.
  // Subscribes to postgres_changes on the tasks table for this user's rows,
  // and on task_collaborators for any collaboration changes.
  // Falls back to a single refetch on tab-focus for resilience.
  useEffect(() => {
    const userId = session?.user?.id
    const supabase = getSupabaseBrowserClient()

    const silentRefetch = async () => {
      try {
        const res = await fetch("/api/tasks")
        if (!res.ok) return
        setTodos(await res.json())
      } catch {}
    }

    const handleVisibility = () => {
      if (!document.hidden) silentRefetch()
    }
    document.addEventListener("visibilitychange", handleVisibility)

    if (!userId || !supabase) {
      return () => document.removeEventListener("visibilitychange", handleVisibility)
    }

    const channel = supabase
      .channel(`tasks-user-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${userId}` },
        () => silentRefetch()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_collaborators', filter: `user_id=eq.${userId}` },
        () => silentRefetch()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [session?.user?.id])

  return {
    todos,          // all tasks including archived (for search)
    activeTodos,    // non-archived tasks (for main dashboard view)
    isLoading,
    error,
    addTodo,
    updateTodo,
    deleteTodo,
    clearAllTodos,
    reorderTodos,
    sortTodos,
    stats,
    refetch: fetchTodos,
  }
}