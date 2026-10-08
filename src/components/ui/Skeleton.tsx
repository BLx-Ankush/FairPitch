'use client'

import React from 'react'

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
  variant?: 'rectangular' | 'circular' | 'text'
}

export function Skeleton({
  className = '',
  variant = 'rectangular',
  ...props
}: SkeletonProps) {
  const variantStyles = {
    rectangular: 'rounded-xl',
    circular: 'rounded-full',
    text: 'rounded-md h-4 w-full',
  }

  return (
    <div
      aria-hidden="true"
      aria-busy="true"
      className={`animate-pulse bg-slate-800/80 ${variantStyles[variant]} ${className}`}
      {...props}
    />
  )
}
