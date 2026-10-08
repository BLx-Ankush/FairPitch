'use client'

import React from 'react'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'outline' | 'brand'
  size?: 'sm' | 'md'
  icon?: React.ReactNode
}

export function Badge({
  children,
  className = '',
  variant = 'default',
  size = 'md',
  icon,
  ...props
}: BadgeProps) {
  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
  }

  const variantStyles = {
    default:
      'bg-slate-800 text-slate-300 border-slate-700/80',
    brand:
      'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    success:
      'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    warning:
      'bg-amber-500/15 text-amber-300 border-amber-500/30',
    danger:
      'bg-red-500/15 text-red-300 border-red-500/30',
    outline:
      'bg-transparent text-slate-300 border-slate-700',
  }

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full border ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  )
}
