import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';

export type ModernSelectOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

type ModernSelectProps = {
  value: string;
  options: ModernSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  ariaLabel?: string;
};

type MenuPosition = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  openAbove: boolean;
};

const normalize = (value: string) => value.toLocaleLowerCase('ru-RU').trim();

export default function ModernSelect({
  value,
  options,
  onChange,
  placeholder = 'Выберите вариант',
  disabled = false,
  searchable,
  searchPlaceholder = 'Найти…',
  className = '',
  buttonClassName = '',
  menuClassName = '',
  ariaLabel,
}: ModernSelectProps) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const canSearch = searchable ?? options.length > 7;
  const selected = options.find(option => option.value === value);

  const filteredOptions = useMemo(() => {
    const needle = normalize(query);
    if (!needle) return options;
    return options.filter(option => normalize(`${option.label} ${option.description || ''}`).includes(needle));
  }, [options, query]);

  const updatePosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const margin = 10;
    const gap = 7;
    const desiredHeight = Math.min(canSearch ? 360 : 320, (filteredOptions.length * 46) + (canSearch ? 58 : 12));
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const openAbove = spaceBelow < Math.min(desiredHeight, 220) && spaceAbove > spaceBelow;
    const available = Math.max(140, (openAbove ? spaceAbove : spaceBelow) - gap);
    const width = Math.max(rect.width, 220);
    const left = Math.min(Math.max(margin, rect.left), Math.max(margin, window.innerWidth - width - margin));
    setPosition({
      left,
      top: openAbove ? rect.top - gap : rect.bottom + gap,
      width: Math.min(width, window.innerWidth - margin * 2),
      maxHeight: Math.min(desiredHeight, available),
      openAbove,
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const selectedIndex = Math.max(0, filteredOptions.findIndex(option => option.value === value && !option.disabled));
    setActiveIndex(selectedIndex);
  }, [open, filteredOptions.length, value]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const handleViewportChange = () => updatePosition();
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    if (canSearch) requestAnimationFrame(() => searchRef.current?.focus());
  }, [open, canSearch]);

  const choose = (option: ModernSelectOption) => {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const moveActive = (direction: 1 | -1) => {
    if (filteredOptions.length === 0) return;
    let next = activeIndex;
    for (let count = 0; count < filteredOptions.length; count += 1) {
      next = (next + direction + filteredOptions.length) % filteredOptions.length;
      if (!filteredOptions[next]?.disabled) break;
    }
    setActiveIndex(next);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const isSearchInput = event.currentTarget === searchRef.current;
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) setOpen(true);
      else moveActive(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Enter' || (event.key === ' ' && !isSearchInput)) {
      if (!open) {
        event.preventDefault();
        setOpen(true);
      } else {
        event.preventDefault();
        const option = filteredOptions[activeIndex];
        if (option) choose(option);
      }
    }
  };

  const menu = open && position && typeof document !== 'undefined' ? createPortal(
    <div
      ref={menuRef}
      id={`${id}-listbox`}
      role="listbox"
      aria-label={ariaLabel}
      className={`fixed z-[200] overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-1.5 shadow-[0_20px_60px_-16px_rgba(15,23,42,0.32)] ring-1 ring-slate-900/5 ${menuClassName}`}
      style={{
        left: position.left,
        top: position.openAbove ? undefined : position.top,
        bottom: position.openAbove ? window.innerHeight - position.top : undefined,
        width: position.width,
        maxHeight: position.maxHeight,
      }}
      onKeyDown={handleKeyDown}
    >
      {canSearch && (
        <div className="relative mb-1 border-b border-slate-100 p-1 pb-2">
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-[65%] text-slate-400" />
          <input
            ref={searchRef}
            value={query}
            onChange={event => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={event => {
              event.stopPropagation();
              handleKeyDown(event);
            }}
            placeholder={searchPlaceholder}
            className="h-10 w-full rounded-xl bg-slate-50 pl-9 pr-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
          />
        </div>
      )}
      <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: position.maxHeight - (canSearch ? 58 : 0) }}>
        {filteredOptions.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-slate-400">Ничего не найдено</div>
        ) : filteredOptions.map((option, index) => {
          const isSelected = option.value === value;
          const isActive = index === activeIndex;
          return (
            <button
              key={`${option.value}-${index}`}
              type="button"
              role="option"
              aria-selected={isSelected}
              disabled={option.disabled}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(option)}
              className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition ${
                isSelected
                  ? 'bg-blue-50 text-[#1677e8]'
                  : isActive
                    ? 'bg-slate-50 text-slate-900'
                    : 'text-slate-700 hover:bg-slate-50'
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{option.label}</span>
                {option.description && <span className="mt-0.5 block truncate text-[11px] text-slate-400">{option.description}</span>}
              </span>
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${isSelected ? 'bg-[#1677e8] text-white' : 'text-transparent'}`}>
                <Check size={12} strokeWidth={2.5} />
              </span>
            </button>
          );
        })}
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <div className={`relative min-w-0 ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        onClick={() => setOpen(current => !current)}
        onKeyDown={handleKeyDown}
        className={`flex h-11 w-full min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 text-left text-sm text-slate-700 shadow-sm outline-none transition hover:border-blue-200 hover:bg-slate-50 focus:border-[#1677e8] focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50 ${buttonClassName}`}
      >
        <span className={`min-w-0 flex-1 truncate ${selected ? '' : 'text-slate-400'}`}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180 text-[#1677e8]' : ''}`} />
      </button>
      {menu}
    </div>
  );
}
