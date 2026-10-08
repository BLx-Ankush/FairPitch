'use client'

import React from 'react'

export function TableContainer({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`w-full overflow-x-auto rounded-xl border border-slate-800/80 ${className}`}>
      {children}
    </div>
  )
}

export function Table({
  children,
  className = '',
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table className={`w-full text-left text-xs sm:text-sm border-collapse ${className}`} {...props}>
      {children}
    </table>
  )
}

export function TableHeader({
  children,
  className = '',
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={`bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold ${className}`} {...props}>
      {children}
    </thead>
  )
}

export function TableBody({
  children,
  className = '',
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={`divide-y divide-slate-800/60 text-slate-200 ${className}`} {...props}>
      {children}
    </tbody>
  )
}

export function TableRow({
  children,
  className = '',
  hoverable = true,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { hoverable?: boolean }) {
  return (
    <tr
      className={`transition-colors ${
        hoverable ? 'hover:bg-slate-850/50' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </tr>
  )
}

export function TableHead({
  children,
  className = '',
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={`py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400 ${className}`} {...props}>
      {children}
    </th>
  )
}

export function TableCell({
  children,
  className = '',
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`py-3.5 px-4 ${className}`} {...props}>
      {children}
    </td>
  )
}

export function TableEmpty({
  children,
  colSpan = 1,
  className = '',
}: {
  children: React.ReactNode
  colSpan?: number
  className?: string
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className={`py-12 text-center text-xs text-slate-400 ${className}`}
      >
        {children}
      </td>
    </tr>
  )
}
