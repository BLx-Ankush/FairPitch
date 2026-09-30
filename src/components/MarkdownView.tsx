'use client';

import React from 'react';
import { Target, CheckCircle2, Quote, AlertCircle, Sparkles, TrendingDown, Layers } from 'lucide-react';

interface MarkdownViewProps {
  content: string;
}

interface ParsedListItem {
  text: string;
  isSubItem: boolean;
}

export function MarkdownView({ content }: MarkdownViewProps) {
  if (!content) return null;

  const lines = content.split('\n');
  const renderedElements: React.ReactNode[] = [];

  let inList = false;
  let listItems: ParsedListItem[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      renderedElements.push(
        <ul key={`list-${renderedElements.length}`} className="my-2.5 space-y-1 pl-1">
          {listItems.map((item, idx) => (
            <li
              key={idx}
              className={`flex items-start gap-2 text-xs leading-relaxed ${
                item.isSubItem
                  ? 'pl-4 text-slate-600 border-l border-slate-200 ml-2 py-0.5'
                  : 'text-slate-800 pt-1 font-normal'
              }`}
            >
              <span
                className={`shrink-0 rounded-full mt-1.5 ${
                  item.isSubItem
                    ? 'h-1 w-1 bg-slate-400'
                    : 'h-1.5 w-1.5 bg-indigo-500'
                }`}
              />
              <span className="flex-1">{parseInline(item.text)}</span>
            </li>
          ))}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  const parseInline = (text: string): React.ReactNode => {
    // Parse **bold**, *italic*, and `code`
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      const token = match[0];
      if (token.startsWith('**') && token.endsWith('**')) {
        parts.push(
          <strong key={match.index} className="font-semibold text-slate-900">
            {token.slice(2, -2)}
          </strong>
        );
      } else if (token.startsWith('*') && token.endsWith('*')) {
        parts.push(
          <em key={match.index} className="italic text-slate-600">
            {token.slice(1, -1)}
          </em>
        );
      } else if (token.startsWith('`') && token.endsWith('`')) {
        parts.push(
          <code
            key={match.index}
            className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-indigo-700 border border-slate-200"
          >
            {token.slice(1, -1)}
          </code>
        );
      }
      lastIndex = match.index + token.length;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  lines.forEach((rawLine, lineIdx) => {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      flushList();
      return;
    }

    // Heading 2: ## Title
    if (trimmed.startsWith('## ')) {
      flushList();
      renderedElements.push(
        <div
          key={`h2-${lineIdx}`}
          className="border-b border-indigo-100 pb-2 mb-3 mt-2 bg-gradient-to-r from-indigo-50/50 to-transparent p-2 rounded-lg"
        >
          <h2 className="text-sm font-bold text-indigo-950 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-600 shrink-0" />
            {parseInline(trimmed.substring(3))}
          </h2>
        </div>
      );
      return;
    }

    // Heading 3: ### 1. Innovation (Deficit: ...)
    if (trimmed.startsWith('### ')) {
      flushList();
      const title = trimmed.substring(4);
      const isFixesHeader =
        title.toLowerCase().includes('fix') ||
        title.toLowerCase().includes('recommendation') ||
        title.toLowerCase().includes('tactical');
      const isDeficitHeader =
        title.toLowerCase().includes('deficit') ||
        title.toLowerCase().includes('gap') ||
        title.toLowerCase().includes('weight:');

      renderedElements.push(
        <div
          key={`h3-${lineIdx}`}
          className={`mt-4 mb-2 p-2.5 rounded-lg flex items-center justify-between border ${
            isFixesHeader
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : isDeficitHeader
              ? 'bg-amber-50/40 border-amber-200/80 text-slate-900'
              : 'bg-slate-100/80 border-slate-200/80 text-slate-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {isFixesHeader ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : isDeficitHeader ? (
              <TrendingDown className="h-4 w-4 text-rose-500 shrink-0" />
            ) : (
              <Layers className="h-4 w-4 text-slate-600 shrink-0" />
            )}
            <h3 className="text-xs font-bold uppercase tracking-wider">
              {parseInline(title)}
            </h3>
          </div>
        </div>
      );
      return;
    }

    // Bullet points: - ... or * ...
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      inList = true;
      const isSubItem = rawLine.startsWith('  ') || rawLine.startsWith('\t');
      listItems.push({
        text: trimmed.substring(2),
        isSubItem,
      });
      return;
    }

    // Numbered list for fixes: 1. ... 2. ... 3. ...
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numberedMatch) {
      flushList();
      const num = numberedMatch[1];
      const body = numberedMatch[2];
      renderedElements.push(
        <div
          key={`num-${lineIdx}`}
          className="my-2 rounded-lg border border-emerald-100 bg-emerald-50/30 p-3 shadow-2xs flex items-start gap-2.5 hover:bg-emerald-50/60 transition-colors"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white shadow-xs">
            {num}
          </span>
          <p className="text-xs text-slate-800 leading-relaxed flex-1">
            {parseInline(body)}
          </p>
        </div>
      );
      return;
    }

    // Normal paragraph
    flushList();
    renderedElements.push(
      <p key={`p-${lineIdx}`} className="my-1.5 text-xs text-slate-700 leading-relaxed">
        {parseInline(trimmed)}
      </p>
    );
  });

  flushList();

  return <div className="space-y-1">{renderedElements}</div>;
}
