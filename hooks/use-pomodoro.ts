"use client"

import { useState, useEffect, useCallback, useRef } from "react"

export type PomodoroPhase = "work" | "break" | "idle"

interface UsePomodoroReturn {
  phase: PomodoroPhase
  seconds: number
  totalSeconds: number
  isRunning: boolean
  sessionCount: number
  start: () => void
  pause: () => void
  reset: () => void
  skipBreak: () => void
  progress: number // 0–1
}

const BREAK_SECONDS = 5 * 60

export function usePomodoro(workMinutes = 25): UsePomodoroReturn {
  const workSeconds = workMinutes * 60
  const workSecondsRef = useRef(workSeconds)

  const [phase, setPhase] = useState<PomodoroPhase>("idle")
  const [seconds, setSeconds] = useState(workSeconds)
  const [isRunning, setIsRunning] = useState(false)
  const [sessionCount, setSessionCount] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const totalSeconds = phase === "break" ? BREAK_SECONDS : workSecondsRef.current

  // When workMinutes changes and timer is idle, update the display
  useEffect(() => {
    workSecondsRef.current = workSeconds
    if (phase === "idle") setSeconds(workSeconds)
  }, [workSeconds, phase])

  const clearTick = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const tick = useCallback(() => {
    setSeconds(prev => {
      if (prev <= 1) {
        clearTick()
        setIsRunning(false)
        setPhase(current => {
          if (current === "work" || current === "idle") {
            setSessionCount(c => c + 1)
            setSeconds(BREAK_SECONDS)
            return "break"
          } else {
            setSeconds(workSecondsRef.current)
            return "idle"
          }
        })
        return 0
      }
      return prev - 1
    })
  }, [])

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(tick, 1000)
    } else {
      clearTick()
    }
    return clearTick
  }, [isRunning, tick])

  const start = () => {
    if (phase === "idle") setPhase("work")
    setIsRunning(true)
  }

  const pause = () => setIsRunning(false)

  const reset = () => {
    clearTick()
    setIsRunning(false)
    setPhase("idle")
    setSeconds(workSecondsRef.current)
  }

  const skipBreak = () => {
    clearTick()
    setIsRunning(false)
    setPhase("idle")
    setSeconds(workSecondsRef.current)
  }

  const progress = 1 - seconds / totalSeconds

  return { phase, seconds, totalSeconds, isRunning, sessionCount, start, pause, reset, skipBreak, progress }
}
