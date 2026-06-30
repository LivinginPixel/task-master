"use client"

import { useState, useEffect, useMemo } from "react"  // Added useMemo
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import { useToast } from "@/components/ui/use-toast"
import { TodoItem } from "@/components/task-item"
import { AddTodoForm } from "@/components/add-task-form"
import { Button } from "@/components/ui/button"
import { PlusCircle, Trash2, SortAsc, Calendar, Clock, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { EnhancedEmptyState } from "@/components/enhanced-empty-state"
import { TaskSkeleton } from "@/components/task-skeleton"
import { useDatabaseTodos } from "@/hooks/use-db-tasks"
import { TodoStats } from "@/components/task-stats"
import { TodoFilter } from "@/components/task-filter"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { Task } from "@/lib/types"
import { NotificationService } from "@/lib/services/notifications"

export default function TodoList() {
  const {
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
  } = useDatabaseTodos()

  const [filteredTodos, setFilteredTodos] = useState<Task[]>([])
  const [filter, setFilter] = useState({ category: "all", priority: "all", status: "active", dueDate: "all" })
  const [showAddForm, setShowAddForm] = useState(false)
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [isFilterTransitioning, setIsFilterTransitioning] = useState(false)
  const { toast } = useToast()

  // Calculate overdue tasks
  const overdueCount = useMemo(() => {
    if (!todos) return 0;
    
    return todos.filter(todo => {
      if (!todo.dueDate || todo.status === "COMPLETED") return false;
      
      const dueDate = new Date(todo.dueDate);
      if (todo.dueTime) {
        const [hours, minutes] = todo.dueTime.split(":").map(Number);
        dueDate.setHours(hours, minutes, 0, 0);
      } else {
        dueDate.setHours(23, 59, 59, 999);
      }
      
      return dueDate < new Date();
    }).length;
  }, [todos]);

  // Enhanced stats with overdue count
  const enhancedStats = useMemo(() => {
    return {
      ...stats,
      overdue: overdueCount
    };
  }, [stats, overdueCount]);

  // Request permission once; startMonitoring is owned by ComprehensiveDashboard.
  useEffect(() => {
    NotificationService.getInstance().requestNotificationPermission()
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt+N: New task
      if (e.altKey && e.key === "n") {
        e.preventDefault()
        setShowAddForm(true)
      }

      // Alt+C: Clear completed tasks
      if (e.altKey && e.key === "c") {
        e.preventDefault()
        const completedIds = todos.filter((t) => t.status === "COMPLETED").map((t) => t.id)
        completedIds.forEach((id) => deleteTodo(id))
        toast({
          title: "Completed tasks cleared",
          description: `${completedIds.length} completed tasks have been removed`,
        })
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [todos, deleteTodo, toast])

  useEffect(() => {
    if (todos) {
      // Trigger transition animation
      setIsFilterTransitioning(true)

      // Small delay for smooth transition
      const timeout = setTimeout(() => {
        let filtered = [...todos]

        if (filter.category !== "all") {
          filtered = filtered.filter((todo) => todo.category === filter.category)
        }

        if (filter.priority !== "all") {
          filtered = filtered.filter((todo) => todo.priority === filter.priority)
        }

        if (filter.status === "completed") {
          filtered = filtered.filter((todo) => todo.status === "COMPLETED")
        } else if (filter.status === "active") {
          filtered = filtered.filter((todo) => todo.status !== "COMPLETED")
        }

        if (filter.dueDate === "today") {
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          filtered = filtered.filter((todo) => {
            if (!todo.dueDate) return false
            const dueDate = new Date(todo.dueDate)
            dueDate.setHours(0, 0, 0, 0)
            return dueDate.getTime() === today.getTime()
          })
        } else if (filter.dueDate === "week") {
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const nextWeek = new Date(today)
          nextWeek.setDate(today.getDate() + 7)

          filtered = filtered.filter((todo) => {
            if (!todo.dueDate) return false
            const dueDate = new Date(todo.dueDate)
            return dueDate >= today && dueDate <= nextWeek
          })
        } else if (filter.dueDate === "overdue") {
          filtered = filtered.filter((todo) => {
            if (!todo.dueDate || todo.status === "COMPLETED") return false
            const dueDate = new Date(todo.dueDate)
            if (todo.dueTime) {
              const [hours, minutes] = todo.dueTime.split(":").map(Number)
              dueDate.setHours(hours, minutes, 0, 0)
            } else {
              dueDate.setHours(23, 59, 59, 999)
            }
            return dueDate < new Date()
          })
        }

        setFilteredTodos(filtered)
        setIsFilterTransitioning(false)
      }, 150)

      return () => clearTimeout(timeout)
    }
    return undefined
  }, [todos, filter])

  const handleDragEnd = (result: any) => {
    if (!result.destination) return

    // Don't do anything if dropped in the same position
    if (result.destination.index === result.source.index) return

    try {
      const items = Array.from(filteredTodos)
      const [reorderedItem] = items.splice(result.source.index, 1)
      items.splice(result.destination.index, 0, reorderedItem)

      setFilteredTodos(items)
      reorderTodos(items.map((item) => item.id))
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reorder tasks",
        variant: "destructive",
      })
    }
  }

  if (error) {
    toast({
      title: "Error",
      description: "Failed to load todos. Please try again.",
      variant: "destructive",
    })
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Use enhanced stats with overdue count */}
      <TodoStats stats={enhancedStats} />

      {/* Enhanced Filter and Actions Section - Mobile First */}
      <div className="flex flex-col gap-3 sm:gap-4">
        <TodoFilter onFilterChange={setFilter} currentFilter={filter} />
        
        {/* Actions Bar - Mobile Optimized */}
        <div className="flex flex-col gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg border bg-card/50 backdrop-blur-sm">
          {/* Primary Action - Add Task Button (Mobile First) */}
          <Button 
            onClick={() => setShowAddForm(!showAddForm)} 
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-spring hover:scale-[1.02] active:scale-[0.98] order-1 sm:order-2"
            size="lg"
          >
            <PlusCircle className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="font-semibold text-sm sm:text-base">
              {showAddForm ? "Cancel" : "Add New Task"}
            </span>
          </Button>

          {/* Secondary Actions - Sort and Clear */}
          <div className="flex flex-wrap gap-2 order-2 sm:order-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="hover:bg-accent transition-colors flex-1 sm:flex-initial text-xs sm:text-sm"
                >
                  <SortAsc className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                  <span className="hidden xs:inline">Sort</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onClick={() => sortTodos("dueDate")} className="text-sm">
                  <Calendar className="h-4 w-4 mr-2" />
                  By Due Date
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => sortTodos("priority")} className="text-sm">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  By Priority
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => sortTodos("createdAt")} className="text-sm">
                  <Clock className="h-4 w-4 mr-2" />
                  By Creation Time
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowClearDialog(true)}
              className="text-destructive hover:text-destructive hover:bg-destructive/10 transition-colors flex-1 sm:flex-initial text-xs sm:text-sm"
            >
              <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
              <span className="hidden xs:inline">Clear All</span>
            </Button>
          </div>
        </div>
      </div>

      {showAddForm && (
        <AddTodoForm
          onAdd={(todo) => {
            addTodo(todo)
            setShowAddForm(false)
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="todos">
          {(provided, snapshot) => (
            <div 
              {...provided.droppableProps} 
              ref={provided.innerRef} 
              className={cn(
                "space-y-3 transition-spring-fast stagger-container",
                snapshot.isDraggingOver && "drop-zone-active p-2",
                isFilterTransitioning && "opacity-50"
              )}
            >
              {isLoading ? (
                <TaskSkeleton />
              ) : filteredTodos.length > 0 ? (
                filteredTodos.map((todo, index) => (
                  <Draggable key={todo.id} draggableId={todo.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={cn(
                          "transition-spring-fast stagger-item",
                          snapshot.isDragging && "opacity-90 scale-[1.02] shadow-xl z-50"
                        )}
                        style={{
                          ...provided.draggableProps.style,
                          transitionTimingFunction: "var(--spring-ease-out)",
                        }}
                      >
                        <TodoItem todo={todo} onUpdate={updateTodo} onDelete={deleteTodo} />
                      </div>
                    )}
                  </Draggable>
                ))
              ) : (
                <EnhancedEmptyState
                  variant={
                    filter.category !== "all" || filter.priority !== "all" || filter.status !== "all" || filter.dueDate !== "all"
                      ? "filtered"
                      : "tasks"
                  }
                  onAction={!showAddForm ? () => setShowAddForm(true) : undefined}
                  actionLabel="Create Your First Task"
                />
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently delete all your tasks and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                clearAllTodos()
                setShowClearDialog(false)
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="text-[10px] sm:text-xs text-muted-foreground text-center mt-6 sm:mt-8 px-2">
        <p className="hidden sm:block">Keyboard shortcuts: Alt+N (New task), Alt+C (Clear completed)</p>
        <p className="sm:hidden">Tap to interact • Swipe to manage</p>
      </div>
    </div>
  )
}