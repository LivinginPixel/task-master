"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DateTimeRangePicker } from "@/components/ui/date-time-range-picker"
import { Switch } from "@/components/ui/switch"
import { X, Plus, Bell, RefreshCw } from "lucide-react"
import { v4 as uuidv4 } from "uuid"
import type { Task, Subtask } from "@/lib/types"

interface AddTaskModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (task: Partial<Task>) => void
  initialData?: {
    title?: string
    description?: string
    priority?: Task["priority"]
    subtasks?: Task["subtasks"]
    duplicatedFromTaskId?: string
  }
}

export function AddTaskModal({ open, onOpenChange, onAdd, initialData }: AddTaskModalProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState<Task["priority"]>("MEDIUM")
  const [startDate, setStartDate] = useState<Date | undefined>()
  const [startTime, setStartTime] = useState("")
  const [endDate, setEndDate] = useState<Date | undefined>()
  const [endTime, setEndTime] = useState("")
  const [subtasks, setSubtasks] = useState<Subtask[]>([])
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("")
  const [notifyOnStart, setNotifyOnStart] = useState(true)
  const [recurrenceType, setRecurrenceType] = useState<Task["recurrenceType"]>(null)
  const [recurrenceInterval, setRecurrenceInterval] = useState(1)
  const [timeError, setTimeError] = useState<string | null>(null)

  // Initialize form with initial data when modal opens or initialData changes
  useEffect(() => {
    if (open && initialData) {
      setTitle(initialData.title || "")
      setDescription(initialData.description || "")
      setPriority(initialData.priority || "MEDIUM")
      // Only include uncompleted subtasks and generate new IDs
      const uncompletedSubtasks = (initialData.subtasks || []).filter(st => !st.completed)
      setSubtasks(uncompletedSubtasks.map(st => ({
        id: uuidv4(), // Generate new IDs for duplicated subtasks
        title: st.title,
        completed: false, // Ensure all are uncompleted
      })))
    } else if (open && !initialData) {
      // Reset form when opening without initial data
      setTitle("")
      setDescription("")
      setPriority("MEDIUM")
      setStartDate(undefined)
      setStartTime("")
      setEndDate(undefined)
      setEndTime("")
      setNotifyOnStart(true)
      setRecurrenceType(null)
      setRecurrenceInterval(1)
      setSubtasks([])
      setNewSubtaskTitle("")
    }
  }, [open, initialData])

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return
    setSubtasks([
      ...subtasks,
      {
        id: uuidv4(),
        title: newSubtaskTitle,
        completed: false,
      }
    ])
    setNewSubtaskTitle("")
  }

  const handleRemoveSubtask = (id: string) => {
    setSubtasks(subtasks.filter(st => st.id !== id))
  }

  const handleSubmit = () => {
    if (!title.trim()) return
    if (!startDate || !startTime) return
    if (!endDate || !endTime) return

    // Reject past start times
    const startDateTime = new Date(startDate)
    const [sh, sm] = startTime.split(":").map(Number)
    startDateTime.setHours(sh, sm, 0, 0)
    if (startDateTime < new Date()) {
      setTimeError("Start time cannot be in the past.")
      return
    }
    setTimeError(null)
    
    const endDateTime = new Date(endDate)
    const [eh, em] = endTime.split(":").map(Number)
    endDateTime.setHours(eh, em, 0, 0)
    
    // Due date = end time
    const dueDateTime = new Date(endDateTime)

    const task: Partial<Task> = {
      title,
      description: description || "",
      priority,
      status: "PENDING",
      dueDate: dueDateTime.toISOString(),
      dueTime: endTime,
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      notifyOnStart: notifyOnStart,
      recurrenceType: recurrenceType ?? null,
      recurrenceInterval: recurrenceInterval,
      subtasks: subtasks.length > 0 ? subtasks.map(st => ({ ...st, task_id: "" })) : undefined,
      category: "",
      tags: [],
      lockedAfterDue: false,
      notes: "",
      duplicatedFromTaskId: initialData?.duplicatedFromTaskId,
      createdAt: new Date().toISOString(),
    }

    onAdd(task)
    
    // Reset form
    setTitle("")
    setDescription("")
    setPriority("MEDIUM")
    setStartDate(undefined)
    setStartTime("")
    setEndDate(undefined)
    setEndTime("")
    setNotifyOnStart(true)
    setRecurrenceType(null)
    setRecurrenceInterval(1)
    setSubtasks([])
    setNewSubtaskTitle("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {initialData ? "Duplicate Task" : "Add New Task"}
          </DialogTitle>
          <DialogDescription>
            {initialData 
              ? "Create a copy of this task with uncompleted subtasks. Set start and end time to schedule it."
              : "Create a new task with details below. Set start and end time (required) - due date will be set automatically."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-semibold">
              Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter task title"
              className="h-11"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-semibold">
              Description
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description..."
              className="min-h-[100px] resize-none"
            />
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label htmlFor="priority" className="text-sm font-semibold">
              Priority
            </Label>
            <Select value={priority} onValueChange={(value: Task["priority"]) => setPriority(value)}>
              <SelectTrigger id="priority" className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="URGENT">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Start and End Time - Required */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Task Duration <span className="text-red-500">*</span>
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Due date will be automatically set to the end time
            </p>
            <DateTimeRangePicker
              startDate={startDate}
              startTime={startTime}
              endDate={endDate}
              endTime={endTime}
              onStartDateChange={(d) => { setStartDate(d); setTimeError(null) }}
              onStartTimeChange={(t) => { setStartTime(t); setTimeError(null) }}
              onEndDateChange={setEndDate}
              onEndTimeChange={setEndTime}
              placeholder="Select start and end time"
            />
            {(!startDate || !startTime || !endDate || !endTime) && (
              <p className="text-xs text-red-500 mt-1">Start and end time are required</p>
            )}
            {timeError && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <span>⚠</span> {timeError}
              </p>
            )}
          </div>

          {/* Start Notification Toggle */}
          <div className="flex items-center justify-between p-3 sm:p-4 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center gap-2 sm:gap-3 flex-1">
              <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <Label htmlFor="notify-on-start" className="text-xs sm:text-sm font-semibold cursor-pointer">
                  Notify when task starts
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Get notified 5 minutes before task start time
                </p>
              </div>
            </div>
            <Switch
              id="notify-on-start"
              checked={notifyOnStart}
              onCheckedChange={setNotifyOnStart}
              className="flex-shrink-0"
            />
          </div>

          {/* Recurrence */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-semibold">Repeat</Label>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {([
                { value: null, label: "None" },
                { value: "daily", label: "Daily" },
                { value: "weekday", label: "Weekdays" },
                { value: "weekly", label: "Weekly" },
                { value: "monthly", label: "Monthly" },
              ] as const).map(opt => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setRecurrenceType(opt.value)}
                  className={`py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
                    recurrenceType === opt.value
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border/60 text-muted-foreground hover:border-accent/40"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {recurrenceType && recurrenceType !== "weekday" && (
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground shrink-0">Every</Label>
                <Select
                  value={String(recurrenceInterval)}
                  onValueChange={(v) => setRecurrenceInterval(Number(v))}
                >
                  <SelectTrigger className="h-8 w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,6].map(n => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">
                  {recurrenceType === "daily" ? "day(s)" : recurrenceType === "weekly" ? "week(s)" : "month(s)"}
                </span>
              </div>
            )}
          </div>

          {/* Subtasks */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Subtasks</Label>
            <div className="space-y-2">
              {subtasks.map((subtask) => (
                <div key={subtask.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                  <span className="flex-1 text-sm">{subtask.title}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveSubtask(subtask.id)}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  placeholder="Add a subtask"
                  className="h-10"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleAddSubtask()
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={handleAddSubtask}
                  variant="outline"
                  className="h-10 px-4"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-11"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || !startDate || !startTime || !endDate || !endTime}
            className="h-11 bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            Add Task
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
