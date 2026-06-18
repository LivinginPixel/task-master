"use client"

import { useState, useEffect, useMemo } from "react"
import type { Task } from "../lib/types"
import { useToast } from "@/components/ui/use-toast"

// Replace localStorage operations with API interactions
export function useDatabaseTodos() {
  const [todos, setTodos] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const { toast } = useToast()

  // Calculate statistics
  const stats = useMemo(() => {
    const total = todos.length
    const completed = todos.filter((todo) => todo.status === "COMPLETED").length
    const pending = total - completed
    const overdue = todos.filter((todo) => {
      if (!todo.dueDate || todo.status === "COMPLETED") return false
      const dueDate = new Date(todo.dueDate)
      if (todo.dueTime) {
        const [hours, minutes] = todo.dueTime.split(":").map(Number)
        dueDate.setHours(hours, minutes, 0, 0)
      } else {
        dueDate.setHours(23, 59, 59, 999)
      }
      return dueDate < new Date()
    }).length
    const dueToday = todos.filter((todo) => {
      if (!todo.dueDate || todo.status === "COMPLETED") return false
      const dueDate = new Date(todo.dueDate)
      const today = new Date()
      return (
        dueDate.getDate() === today.getDate() &&
        dueDate.getMonth() === today.getMonth() &&
        dueDate.getFullYear() === today.getFullYear()
      )
    }).length

    return { total, completed, pending, overdue, dueToday }
  }, [todos])

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

  // Background sync — poll every 15s so collaborators see changes without refreshing.
  // Runs silently (no loading spinner). Pauses when the tab is hidden.
  useEffect(() => {
    const POLL_MS = 15_000

    const sync = async () => {
      try {
        const res = await fetch("/api/tasks")
        if (!res.ok) return
        const data = await res.json()
        setTodos(data)
      } catch {
        // silent — don't disrupt the user if background sync fails
      }
    }

    const interval = setInterval(() => {
      if (!document.hidden) sync()
    }, POLL_MS)

    // Sync immediately when the user returns to the tab
    const handleVisibility = () => {
      if (!document.hidden) sync()
    }
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      clearInterval(interval)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [])

  return {
    todos,
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