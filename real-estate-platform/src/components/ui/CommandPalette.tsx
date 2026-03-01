'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface CommandItem {
  label: string;
  href: string;
  section: string;
  keywords?: string;
}

const COMMANDS: CommandItem[] = [
  { label: 'Dashboard', href: '/dashboard', section: 'Navigation', keywords: 'home overview' },
  { label: 'Pipeline', href: '/pipeline', section: 'Navigation', keywords: 'deals board kanban' },
  { label: 'Properties', href: '/properties', section: 'Navigation', keywords: 'search browse filter' },
  { label: 'Send Offers', href: '/offers', section: 'Navigation', keywords: 'email bulk' },
  { label: 'Offer Tracking', href: '/offers/tracking', section: 'Navigation', keywords: 'opens clicks bounces' },
  { label: 'Sequences', href: '/sequences', section: 'Navigation', keywords: 'follow up automation' },
  { label: 'Analytics', href: '/analytics', section: 'Navigation', keywords: 'charts graphs funnel' },
  { label: 'Rules', href: '/rules', section: 'Navigation', keywords: 'qualification scoring filter' },
  { label: 'Skip Trace', href: '/skip-trace', section: 'Navigation', keywords: 'contact lookup phone email' },
  { label: 'Knowledge Base', href: '/kb', section: 'Navigation', keywords: 'articles help learn' },
  { label: 'Compliance', href: '/compliance', section: 'Navigation', keywords: 'tcpa dnc audit consent' },
  { label: 'Monitoring', href: '/monitoring', section: 'Navigation', keywords: 'email health deliverability' },
  { label: 'Import CSV', href: '/import', section: 'Actions', keywords: 'upload propstream data' },
  { label: 'Settings', href: '/settings', section: 'Actions', keywords: 'api keys preferences account' },
];

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? COMMANDS.filter((cmd) => {
        const q = query.toLowerCase();
        return (
          cmd.label.toLowerCase().includes(q) ||
          cmd.section.toLowerCase().includes(q) ||
          (cmd.keywords && cmd.keywords.includes(q))
        );
      })
    : COMMANDS;

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setQuery('');
    setSelectedIndex(0);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setSelectedIndex(0);
  }, []);

  const handleSelect = useCallback(
    (item: CommandItem) => {
      handleClose();
      router.push(item.href);
    },
    [handleClose, router]
  );

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          handleClose();
        } else {
          handleOpen();
        }
      }
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleOpen, handleClose]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Arrow key navigation
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && filtered[selectedIndex]) {
        e.preventDefault();
        handleSelect(filtered[selectedIndex]);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex, handleSelect]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  // Group by section
  const sections = new Map<string, CommandItem[]>();
  for (const item of filtered) {
    const existing = sections.get(item.section) ?? [];
    existing.push(item);
    sections.set(item.section, existing);
  }

  let globalIndex = 0;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      {/* Dialog */}
      <div className="relative mx-auto mt-[15vh] max-w-lg">
        <div className="rounded-xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
            <svg className="h-5 w-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search pages..."
              className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
            />
            <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-mono text-gray-400">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[50vh] overflow-y-auto py-2">
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                No results found
              </div>
            ) : (
              Array.from(sections.entries()).map(([section, items]) => (
                <div key={section}>
                  <div className="px-4 pt-2 pb-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      {section}
                    </p>
                  </div>
                  {items.map((item) => {
                    const idx = globalIndex++;
                    const isSelected = idx === selectedIndex;
                    return (
                      <button
                        key={item.href}
                        onClick={() => handleSelect(item)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                          isSelected
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span className="font-medium">{item.label}</span>
                        {isSelected && (
                          <span className="ml-auto text-xs text-blue-400">Enter to open</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer hint */}
          <div className="border-t border-gray-100 px-4 py-2 flex items-center gap-4 text-[10px] text-gray-400">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-gray-200 bg-gray-50 px-1 py-0.5 font-mono">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-gray-200 bg-gray-50 px-1 py-0.5 font-mono">↵</kbd>
              open
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-gray-200 bg-gray-50 px-1 py-0.5 font-mono">esc</kbd>
              close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
