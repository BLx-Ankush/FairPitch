'use client'

import React, { useEffect } from 'react'
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react'

export interface ToastProps {
  id?: string
  type?: 'success' | 'error' | 'info' | 'warning'
  title?: string
  message: string
  duration?: number
  onClose: () => void
}

export function Toast({
  type = 'info',
  title,
  message,
  duration = 4000,
  onClose,
}: ToastProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration)
      return () => clearTimeout(timer)
    }
  }, [duration, onClose])

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
    info: <Info className="w-5 h-5 text-indigo-400 shrink-0" />,
  }

  const borderStyles = {
    success: 'border-emerald-500/40 bg-slate-900/95 text-emerald-200',
    error: 'border-red-500/40 bg-slate-900/95 text-red-200',
    warning: 'border-amber-500/40 bg-slate-900/95 text-amber-200',
    info: 'border-indigo-500/40 bg-slate-900/95 text-indigo-200',
  }

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      aria-live="polite"
      className={`fixed bottom-6 right-6 z-50 max-w-sm w-full p-4 rounded-xl border shadow-2xl backdrop-blur-md flex items-start gap-3 transition-all duration-300 ${borderStyles[type]}`}
    >
      {icons[type]}

      <div className="flex-1 min-w-0">
        {title && (
          <h4 className="text-xs font-bold text-slate-100 mb-0.5">{title}</h4>
        )}
        <p className="text-xs text-slate-300 leading-relaxed break-words">
          {message}
        </p>
      </div>

      <button
        onClick={onClose}
        aria-label="Dismiss notification"
        className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
