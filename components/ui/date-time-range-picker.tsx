"use client"

import * as React from "react"
import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"
import { format, addDays, startOfWeek, addWeeks, startOfDay } from "date-fns"
import { CalendarIcon, Clock, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface DateTimeRangePickerProps {
  startDate: Date | undefined
  startTime: string
  endDate: Date | undefined
  endTime: string
  onStartDateChange: (date: Date | undefined) => void
  onStartTimeChange: (time: string) => void
  onEndDateChange: (date: Date | undefined) => void
  onEndTimeChange: (time: string) => void
  onClear?: () => void
  className?: string
  disabled?: boolean
  placeholder?: string
}

type QuickOption = {
  label: string
  getStartDate: () => Date
  getEndDate: () => Date
}

export function DateTimeRangePicker({
  startDate,
  startTime,
  endDate,
  endTime,
  onStartDateChange,
  onStartTimeChange,
  onEndDateChange,
  onEndTimeChange,
  onClear,
  className,
  disabled = false,
  placeholder = "Select start and end time",
}: DateTimeRangePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [mode, setMode] = React.useState<"quick" | "start-date" | "start-time" | "end-date" | "end-time">("quick")
  const [tempDate, setTempDate] = React.useState<Date | null>(null)

  // Reset when popover closes
  React.useEffect(() => {
    if (!isOpen) {
      setTempDate(null)
      setMode("quick")
    }
  }, [isOpen])

  // Quick date options (Todoist/ClickUp style)
  const quickOptions: QuickOption[] = React.useMemo(() => {
    const now = new Date()
    const today = startOfDay(now)
    const tomorrow = addDays(today, 1)
    const nextWeek = addWeeks(startOfWeek(today, { weekStartsOn: 1 }), 1)
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    return [
      {
        label: "Today",
        getStartDate: () => today,
        getEndDate: () => {
          const end = new Date(today)
          end.setHours(23, 59, 0, 0)
          return end
        },
      },
      {
        label: "Tomorrow",
        getStartDate: () => tomorrow,
        getEndDate: () => {
          const end = new Date(tomorrow)
          end.setHours(23, 59, 0, 0)
          return end
        },
      },
      {
        label: "Next Week",
        getStartDate: () => nextWeek,
        getEndDate: () => {
          const end = addDays(nextWeek, 6)
          end.setHours(23, 59, 0, 0)
          return end
        },
      },
      {
        label: "Next Month",
        getStartDate: () => nextMonth,
        getEndDate: () => {
          const end = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0)
          end.setHours(23, 59, 0, 0)
          return end
        },
      },
    ]
  }, [])

  const handleQuickSelect = (option: QuickOption) => {
    const start = option.getStartDate()
    const end = option.getEndDate()
    
    // Default start = current time (rounded up to next 15 min), end = +1 hour
    const now = new Date()
    const minutes = Math.ceil(now.getMinutes() / 15) * 15
    now.setMinutes(minutes, 0, 0)
    if (minutes === 60) { now.setHours(now.getHours() + 1, 0, 0, 0) }
    const endDefault = new Date(now.getTime() + 60 * 60 * 1000)

    start.setHours(now.getHours(), now.getMinutes(), 0, 0)
    end.setHours(endDefault.getHours(), endDefault.getMinutes(), 0, 0)

    const pad = (n: number) => String(n).padStart(2, "0")
    const startStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`
    const endStr = `${pad(endDefault.getHours())}:${pad(endDefault.getMinutes())}`

    onStartDateChange(start)
    onStartTimeChange(startStr)
    onEndDateChange(end)
    onEndTimeChange(endStr)
    
    // Go to time adjustment mode
    setMode("start-time")
    setTempDate(start)
  }

  const handleStartDateSelect = (date: Date | null) => {
    if (disabled || !date) return
    
    setTempDate(date)
    setMode("start-time")
  }

  const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled || !tempDate) return
    
    const newTime = e.target.value
    if (newTime) {
      const dateTime = new Date(tempDate)
      const [hours, minutes] = newTime.split(":").map(Number)
      if (!isNaN(hours) && !isNaN(minutes)) {
        dateTime.setHours(hours, minutes, 0, 0)
      }
      
      onStartDateChange(dateTime)
      onStartTimeChange(newTime)
    } else {
      onStartDateChange(tempDate)
      onStartTimeChange("")
    }
  }

  const handleStartTimeConfirm = () => {
    if (startTime) {
      setMode("end-date")
      setTempDate(null)
    }
  }

  const handleEndDateSelect = (date: Date | null) => {
    if (disabled || !date) return
    
    setTempDate(date)
    setMode("end-time")
  }

  const handleEndTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled || !tempDate) return
    
    const newTime = e.target.value
    if (newTime) {
      const dateTime = new Date(tempDate)
      const [hours, minutes] = newTime.split(":").map(Number)
      if (!isNaN(hours) && !isNaN(minutes)) {
        dateTime.setHours(hours, minutes, 0, 0)
      }
      
      onEndDateChange(dateTime)
      onEndTimeChange(newTime)
    } else {
      onEndDateChange(tempDate)
      onEndTimeChange("")
    }
  }

  const handleEndTimeConfirm = () => {
    setIsOpen(false)
  }

  const handleCustomDate = () => {
    setMode("start-date")
  }

  const handleClear = () => {
    if (disabled || !onClear) return
    onStartDateChange(undefined)
    onStartTimeChange("")
    onEndDateChange(undefined)
    onEndTimeChange("")
    onClear()
  }

  const displayValue = React.useMemo(() => {
    if (!startDate) return ""
    
    const startStr = format(startDate, "MMM d, yyyy") + (startTime ? ` ${startTime}` : "")
    if (!endDate) return startStr
    
    const endStr = format(endDate, "MMM d, yyyy") + (endTime ? ` ${endTime}` : "")
    return `${startStr} - ${endStr}`
  }, [startDate, startTime, endDate, endTime])

  const hasValue = startDate || endDate

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal h-11",
            !hasValue && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
          {hasValue ? (
            <span className="flex-1 text-sm truncate">{displayValue}</span>
          ) : (
            <span className="flex-1 text-sm text-muted-foreground truncate">{placeholder}</span>
          )}
          {hasValue && onClear && (
            <X
              className="ml-2 h-4 w-4 opacity-50 hover:opacity-100 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation()
                handleClear()
              }}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-auto p-0 sm:p-2" 
        align="start"
        sideOffset={4}
      >
        <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 max-w-[calc(100vw-2rem)] sm:max-w-none">
          {/* Quick Options (Todoist/ClickUp style) */}
          {mode === "quick" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {quickOptions.map((option) => (
                  <Button
                    key={option.label}
                    type="button"
                    variant="outline"
                    onClick={() => handleQuickSelect(option)}
                    className="h-9 sm:h-10 text-xs sm:text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleCustomDate}
                className="w-full h-9 sm:h-10 text-sm font-medium"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                Choose Custom Date
              </Button>
            </div>
          )}

          {/* Start Date Selection */}
          {mode === "start-date" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-semibold text-foreground">
                  Start Date
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setMode("quick")}
                  className="h-7 text-xs"
                >
                  Back
                </Button>
              </div>
              <div className="w-full sm:w-auto">
                <DatePicker
                  selected={startDate || null}
                  onChange={handleStartDateSelect}
                  inline
                  calendarClassName="!border-0"
                  className="react-datepicker-custom"
                  minDate={new Date()}
                  dateFormat="MMM d, yyyy"
                />
              </div>
            </div>
          )}

          {/* Start Time Selection */}
          {mode === "start-time" && tempDate && (
            <div className="space-y-3 min-w-[200px] sm:min-w-[280px]">
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" />
                  Start Time
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setMode("start-date")}
                  className="h-7 text-xs"
                >
                  Back
                </Button>
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground mb-2">
                {format(tempDate, "EEEE, MMMM d, yyyy")}
              </div>
              <input
                type="time"
                value={startTime || ""}
                onChange={handleStartTimeChange}
                step="1"
                className={cn(
                  "w-full h-10 sm:h-11 px-3 rounded-md border border-input bg-background text-sm",
                  "focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
                )}
                autoFocus
              />
              {startTime && (
                <Button
                  type="button"
                  onClick={handleStartTimeConfirm}
                  className="w-full h-9 sm:h-10 text-sm"
                  variant="default"
                >
                  Continue to End Date
                </Button>
              )}
            </div>
          )}

          {/* End Date Selection */}
          {mode === "end-date" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-semibold text-foreground">
                  End Date
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setMode("start-time")}
                  className="h-7 text-xs"
                >
                  Back
                </Button>
              </div>
              <div className="w-full sm:w-auto">
                <DatePicker
                  selected={endDate || null}
                  onChange={handleEndDateSelect}
                  inline
                  calendarClassName="!border-0"
                  className="react-datepicker-custom"
                  minDate={startDate || new Date()}
                  dateFormat="MMM d, yyyy"
                />
              </div>
            </div>
          )}

          {/* End Time Selection */}
          {mode === "end-time" && tempDate && (
            <div className="space-y-3 min-w-[200px] sm:min-w-[280px]">
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" />
                  End Time
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setMode("end-date")}
                  className="h-7 text-xs"
                >
                  Back
                </Button>
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground mb-2">
                {format(tempDate, "EEEE, MMMM d, yyyy")}
              </div>
              <input
                type="time"
                value={endTime || ""}
                onChange={handleEndTimeChange}
                step="1"
                className={cn(
                  "w-full h-10 sm:h-11 px-3 rounded-md border border-input bg-background text-sm",
                  "focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
                )}
                autoFocus
              />
              {endTime && (
                <Button
                  type="button"
                  onClick={handleEndTimeConfirm}
                  className="w-full h-9 sm:h-10 text-sm"
                  variant="default"
                >
                  Done
                </Button>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
