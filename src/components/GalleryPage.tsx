import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckSquare,
  Cloud,
  Copy,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  HardDrive,
  Image as ImageIcon,
  Images,
  Loader2,
  Play,
  RefreshCw,
  Search,
  Square,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react';
import ModernSelect from './ui/ModernSelect';
import { FUNNEL_TYPE_ORDER, getFunnelTypeLabel } from '../utils/funnelTypes';

type MediaType = 'image' | 'video' | 'pdf';
type MediaCategory = 'all' | MediaType;
type MediaSourceFilter = 'all' | 'project' | 'uploaded';

interface MediaLibraryItem {
  id: string;
  filename: string;
  name: string;
  url: string;
  type: MediaType;
  mimeType: string;
  size: number;
  createdAt: string;
  source: 'project' | 'upload' | 'cloud';
  usedIn: Array<{ id: string; title: string; type?: string }>;
}

const categoryLabels: Record<MediaCategory, string> = {
  all: 'Все файлы',
  image: 'Изображения',
  video: 'Видео',
  pdf: 'PDF',
};

function formatBytes(bytes: number) {
  if (!bytes) return 'Размер неизвестен';
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} МБ`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getFullYear() <= 1970) return 'Дата неизвестна';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function sourceLabel(source: MediaLibraryItem['source']) {
  if (source === 'project') return 'Файл проекта';
  if (source === 'cloud') return 'В облаке';
  return 'Загрузка';
}

export default function GalleryPage() {
  const [items, setItems] = useState<MediaLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<MediaCategory>('all');
  const [sourceFilter, setSourceFilter] = useState<MediaSourceFilter>('all');
  // 'all' — все, 'unused' — ничьи, иначе id воронки.
  const [funnelFilter, setFunnelFilter] = useState<string>('all');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'name'>('newest');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<MediaLibraryItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MediaLibraryItem[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadLibrary = async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/media/library');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не удалось загрузить галерею');
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (loadError: any) {
      setError(loadError?.message || 'Не удалось загрузить галерею');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLibrary();
  }, []);

  useEffect(() => {
    if (!preview) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreview(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [preview]);

  const counts = useMemo(() => ({
    all: items.length,
    image: items.filter(item => item.type === 'image').length,
    video: items.filter(item => item.type === 'video').length,
    pdf: items.filter(item => item.type === 'pdf').length,
    project: items.filter(item => item.source === 'project').length,
    uploaded: items.filter(item => item.source !== 'project').length,
  }), [items]);

  // Один список на два вопроса: «в какой воронке файл» и «в воронке какого вида».
  // Значения различаются префиксом, поэтому воронка с id вроде 'lead' ничего не ломает.
  const funnelOptions = useMemo(() => {
    const byId = new Map<string, string>();
    const presentTypes = new Set<string>();
    for (const item of items) {
      for (const funnel of item.usedIn) {
        byId.set(funnel.id, funnel.title);
        if (funnel.type) presentTypes.add(funnel.type);
      }
    }
    const unusedCount = items.filter(item => item.usedIn.length === 0).length;
    const typeOptions = FUNNEL_TYPE_ORDER
      .filter(type => presentTypes.has(type))
      .map(type => ({
        value: `type:${type}`,
        label: `Вид: ${getFunnelTypeLabel(type)} · ${items.filter(item => item.usedIn.some(f => f.type === type)).length}`,
      }));

    return [
      { value: 'all', label: `Все воронки · ${items.length}` },
      ...typeOptions,
      ...Array.from(byId, ([value, title]) => ({
        value: `funnel:${value}`,
        label: `${title} · ${items.filter(item => item.usedIn.some(f => f.id === value)).length}`,
      })),
      ...(unusedCount ? [{ value: 'unused', label: `Нигде не используются · ${unusedCount}` }] : []),
    ];
  }, [items]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('ru-RU');
    const filtered = items.filter(item => {
      if (category !== 'all' && item.type !== category) return false;
      if (sourceFilter === 'project' && item.source !== 'project') return false;
      if (sourceFilter === 'uploaded' && item.source === 'project') return false;
      if (funnelFilter === 'unused' && item.usedIn.length > 0) return false;
      if (funnelFilter.startsWith('type:')
        && !item.usedIn.some(funnel => funnel.type === funnelFilter.slice(5))) return false;
      if (funnelFilter.startsWith('funnel:')
        && !item.usedIn.some(funnel => funnel.id === funnelFilter.slice(7))) return false;
      if (normalizedQuery && !`${item.name} ${item.filename}`.toLocaleLowerCase('ru-RU').includes(normalizedQuery)) {
        return false;
      }
      return true;
    });

    return [...filtered].sort((left, right) => {
      if (sort === 'name') return left.name.localeCompare(right.name, 'ru');
      const difference = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      return sort === 'oldest' ? -difference : difference;
    });
  }, [items, category, sourceFilter, funnelFilter, query, sort]);

  const uploadFiles = async (files: File[]) => {
    const supported = files.filter(file => (
      file.type.startsWith('image/')
      || file.type.startsWith('video/')
      || file.type === 'application/pdf'
      || /\.(jpe?g|png|gif|webp|mp4|mov|avi|webm|mkv|pdf)$/i.test(file.name)
    ));
    if (supported.length === 0) {
      setError('Поддерживаются изображения, видео и PDF');
      return;
    }

    setUploading(true);
    setError('');
    setUploadProgress({ current: 0, total: supported.length });
    const failures: string[] = [];

    for (let index = 0; index < supported.length; index += 1) {
      const file = supported[index];
      setUploadProgress({ current: index + 1, total: supported.length });
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', file.type.startsWith('video/') ? 'video' : file.type === 'application/pdf' ? 'document' : 'photo');
        const response = await fetch('/api/media/upload', { method: 'POST', body: formData });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Ошибка загрузки');
      } catch {
        failures.push(file.name);
      }
    }

    setUploading(false);
    setUploadProgress({ current: 0, total: 0 });
    if (failures.length > 0) {
      setError(`Не удалось загрузить: ${failures.join(', ')}`);
    }
    await loadLibrary(true);
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleItemClick = (item: MediaLibraryItem) => {
    if (selectMode) toggleSelection(item.id);
    else setPreview(item);
  };

  const copyLinks = async (links: string[]) => {
    await navigator.clipboard.writeText(links.join('\n'));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const selectedItems = items.filter(item => selectedIds.has(item.id));
  const deletableSelectedItems = selectedItems.filter(item => item.source !== 'project' && item.usedIn.length === 0);

  const deleteItems = async () => {
    if (!deleteTarget) return;
    const deletableItems = deleteTarget.filter(item => item.source !== 'project' && item.usedIn.length === 0);
    if (deletableItems.length === 0) return;

    setDeleting(true);
    setError('');
    const deletedIds: string[] = [];
    const failures: string[] = [];

    for (const item of deletableItems) {
      try {
        const response = await fetch('/api/admin/media/library', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: item.id }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Не удалось удалить файл');
        deletedIds.push(item.id);
      } catch (deleteError: any) {
        failures.push(`${item.name}: ${deleteError?.message || 'ошибка удаления'}`);
      }
    }

    if (deletedIds.length > 0) {
      const deletedIdSet = new Set(deletedIds);
      setItems(previous => previous.filter(item => !deletedIdSet.has(item.id)));
      setSelectedIds(previous => new Set([...previous].filter(id => !deletedIdSet.has(id))));
      if (preview && deletedIdSet.has(preview.id)) setPreview(null);
      setNotice(deletedIds.length === 1 ? 'Файл удалён' : `Удалено файлов: ${deletedIds.length}`);
      window.setTimeout(() => setNotice(''), 2200);
    }
    if (failures.length > 0) setError(failures.join(' · '));

    setDeleting(false);
    setDeleteTarget(null);
  };

  return (
    <div
      className="admin-page relative flex-1 min-w-0 overflow-y-auto bg-[#f8f8fb] text-slate-900 custom-scrollbar"
      onDragEnter={(event) => {
        event.preventDefault();
        if (event.dataTransfer.types.includes('Files')) setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        void uploadFiles(Array.from(event.dataTransfer.files || []));
      }}
    >
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Images size={21} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Галерея</h1>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-500">
                  {items.length} {items.length === 1 ? 'файл' : 'файлов'}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Общее хранилище всех воронок: файл можно загрузить один раз и вставить в несколько.
                Отфильтруйте по воронке, чтобы увидеть только её материалы.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadLibrary()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
              aria-label="Обновить галерею"
            >
              <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#1677e8] px-5 text-sm font-medium text-white shadow-sm transition hover:bg-[#0f69ce] disabled:cursor-wait disabled:opacity-60 sm:flex-none"
            >
              {uploading ? <Loader2 size={17} className="animate-spin" /> : <Upload size={17} />}
              {uploading
                ? `Загрузка ${uploadProgress.current}/${uploadProgress.total}`
                : 'Загрузить файлы'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,application/pdf,.pdf"
              className="hidden"
              onChange={(event) => {
                void uploadFiles(Array.from(event.target.files || []));
                event.target.value = '';
              }}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        {error && (
          <div className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span>{error}</span>
            <button type="button" onClick={() => setError('')} className="shrink-0 text-rose-400 hover:text-rose-700">
              <X size={16} />
            </button>
          </div>
        )}

        {notice && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <Check size={16} />
            <span>{notice}</span>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="hidden self-start rounded-2xl border border-slate-200 bg-white p-3 lg:sticky lg:top-28 lg:block">
            <p className="px-3 pb-2 pt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">Тип файлов</p>
            {([
              { id: 'all', icon: FolderOpen },
              { id: 'image', icon: ImageIcon },
              { id: 'video', icon: Video },
              { id: 'pdf', icon: FileText },
            ] as Array<{ id: MediaCategory; icon: React.ComponentType<{ size?: number }> }>).map(item => {
              const Icon = item.icon;
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setCategory(item.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                    category === item.id ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon size={17} />
                  <span className="min-w-0 flex-1 truncate">{categoryLabels[item.id]}</span>
                  <span className={`text-xs ${category === item.id ? 'text-slate-300' : 'text-slate-400'}`}>{counts[item.id]}</span>
                </button>
              );
            })}

            <div className="my-3 h-px bg-slate-100" />
            <p className="px-3 pb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">Источник</p>
            {([
              { id: 'all', label: 'Все источники', icon: HardDrive, count: counts.all },
              { id: 'project', label: 'Файлы проекта', icon: FolderOpen, count: counts.project },
              { id: 'uploaded', label: 'Мои загрузки', icon: Cloud, count: counts.uploaded },
            ] as Array<{ id: MediaSourceFilter; label: string; icon: React.ComponentType<{ size?: number }>; count: number }>).map(item => {
              const Icon = item.icon;
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setSourceFilter(item.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                    sourceFilter === item.id ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon size={16} />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <span className="text-xs text-slate-400">{item.count}</span>
                </button>
              );
            })}

            <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center">
              <Upload size={18} className="mx-auto text-slate-400" />
              <p className="mt-2 text-xs leading-5 text-slate-500">Можно перетащить файлы прямо на страницу</p>
              <p className="mt-1 text-[10px] text-slate-400">До 50 МБ на файл</p>
            </div>
          </aside>

          <section className="min-w-0">
            <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder="Найти файл по названию"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  <ModernSelect
                    value={category}
                    onChange={nextValue => setCategory(nextValue as MediaCategory)}
                    options={Object.entries(categoryLabels).map(([optionValue, label]) => ({
                      value: optionValue,
                      label: `${label} · ${counts[optionValue as MediaCategory]}`,
                    }))}
                    className="lg:hidden sm:min-w-[150px]"
                    buttonClassName="h-10 shadow-none"
                    ariaLabel="Тип файлов"
                  />
                  <ModernSelect
                    value={funnelFilter}
                    onChange={setFunnelFilter}
                    options={funnelOptions}
                    className="sm:min-w-[190px]"
                    buttonClassName="h-10 shadow-none"
                    ariaLabel="Воронка"
                  />
                  <ModernSelect
                    value={sourceFilter}
                    onChange={nextValue => setSourceFilter(nextValue as MediaSourceFilter)}
                    options={[
                      { value: 'all', label: 'Все источники' },
                      { value: 'project', label: 'Файлы проекта' },
                      { value: 'uploaded', label: 'Мои загрузки' },
                    ]}
                    className="lg:hidden sm:min-w-[160px]"
                    buttonClassName="h-10 shadow-none"
                    ariaLabel="Источник файлов"
                  />
                  <ModernSelect
                    value={sort}
                    onChange={nextValue => setSort(nextValue as typeof sort)}
                    options={[
                      { value: 'newest', label: 'Сначала новые' },
                      { value: 'oldest', label: 'Сначала старые' },
                      { value: 'name', label: 'По названию' },
                    ]}
                    buttonClassName="h-10 shadow-none"
                    ariaLabel="Сортировка файлов"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSelectMode(previous => !previous);
                      setSelectedIds(new Set());
                    }}
                    className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3.5 text-sm transition ${
                      selectMode
                        ? 'border-slate-950 bg-slate-950 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {selectMode ? <CheckSquare size={16} /> : <Square size={16} />}
                    <span>{selectMode ? 'Готово' : 'Выбрать'}</span>
                  </button>
                </div>
              </div>

              {selectMode && (
                <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-xs text-slate-500">
                    Выбрано: <span className="font-medium text-slate-800">{selectedIds.size}</span>
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedIds(new Set(filteredItems.map(item => item.id)))}
                      className="h-8 rounded-lg px-3 text-xs text-slate-600 hover:bg-slate-100"
                    >
                      Выбрать все
                    </button>
                    <button
                      type="button"
                      onClick={() => copyLinks(selectedItems.map(item => item.url))}
                      disabled={selectedItems.length === 0}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-100 px-3 text-xs text-slate-700 hover:bg-slate-200 disabled:opacity-40"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? 'Скопировано' : 'Скопировать ссылки'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(selectedItems)}
                      disabled={deletableSelectedItems.length === 0}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-rose-50 px-3 text-xs text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 size={14} />
                      Удалить{deletableSelectedItems.length > 0 ? ` (${deletableSelectedItems.length})` : ''}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-400">
                <Loader2 size={22} className="mr-2 animate-spin" />
                Загружаю медиатеку...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <Images size={25} />
                </div>
                <h2 className="mt-4 text-base font-medium text-slate-800">
                  {items.length === 0 ? 'Галерея пока пустая' : 'Файлы не найдены'}
                </h2>
                <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">
                  {items.length === 0
                    ? 'Загрузите изображения, видео или PDF — они сразу появятся здесь.'
                    : 'Измените запрос или сбросьте выбранные фильтры.'}
                </p>
                {items.length === 0 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm text-white"
                  >
                    <Upload size={16} />
                    Загрузить файлы
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between px-1">
                  <p className="text-xs text-slate-500">Показано {filteredItems.length} из {items.length}</p>
                  <p className="hidden text-xs text-slate-400 sm:block">Нажмите на файл, чтобы открыть его</p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {filteredItems.map(item => {
                    const selected = selectedIds.has(item.id);
                    return (
                      <article
                        key={item.id}
                        className={`group relative overflow-hidden rounded-2xl border bg-white transition ${
                          selected
                            ? 'border-slate-950 ring-2 ring-slate-950/10'
                            : 'border-slate-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleItemClick(item)}
                          className="relative block aspect-[4/3] w-full overflow-hidden bg-slate-100 text-left"
                          aria-label={`${selectMode ? 'Выбрать' : 'Открыть'} ${item.name}`}
                        >
                          {item.type === 'image' ? (
                            <img
                              src={item.url}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                            />
                          ) : item.type === 'video' ? (
                            <>
                              <video
                                src={item.url}
                                muted
                                playsInline
                                preload="metadata"
                                className="h-full w-full object-cover"
                              />
                              <span className="absolute inset-0 flex items-center justify-center bg-slate-950/10">
                                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-sm backdrop-blur">
                                  <Play size={18} className="ml-0.5 fill-current" />
                                </span>
                              </span>
                            </>
                          ) : (
                            <span className="flex h-full flex-col items-center justify-center bg-slate-50 text-slate-400">
                              <FileText size={34} />
                              <span className="mt-2 text-xs font-medium uppercase tracking-[0.12em]">PDF</span>
                            </span>
                          )}

                          <span className="absolute left-2.5 top-2.5 rounded-lg bg-white/90 px-2 py-1 text-[10px] font-medium text-slate-600 shadow-sm backdrop-blur">
                            {item.type === 'image' ? 'Фото' : item.type === 'video' ? 'Видео' : 'PDF'}
                          </span>

                          {selectMode && (
                            <span className={`absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-lg border shadow-sm ${
                              selected ? 'border-slate-950 bg-slate-950 text-white' : 'border-white bg-white/90 text-slate-400'
                            }`}>
                              {selected ? <Check size={15} /> : <Square size={14} />}
                            </span>
                          )}
                        </button>

                        {!selectMode && item.source !== 'project' && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setDeleteTarget([item]);
                            }}
                            disabled={item.usedIn.length > 0}
                            className="absolute right-2.5 top-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-white/95 text-rose-600 opacity-0 shadow-sm backdrop-blur transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-300 group-hover:opacity-100 focus:opacity-100"
                            aria-label={item.usedIn.length > 0 ? 'Файл используется в воронке' : `Удалить ${item.name}`}
                            title={item.usedIn.length > 0 ? 'Сначала удалите файл из воронки' : 'Удалить файл'}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}

                        <div className="p-3.5">
                          <h3 className="truncate text-[13px] font-medium text-slate-800" title={item.name}>{item.name}</h3>
                          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                            <span>{formatBytes(item.size)}</span>
                            <span>•</span>
                            <span className="truncate">{formatDate(item.createdAt)}</span>
                          </div>
                          <div className="mt-3 border-t border-slate-100 pt-3 text-[11px] leading-4">
                            {item.usedIn.length > 0 ? (
                              <span className="text-emerald-700">
                                Используется в {item.usedIn.length} {item.usedIn.length === 1 ? 'воронке' : 'воронках'}
                              </span>
                            ) : (
                              <span className="text-slate-400">{sourceLabel(item.source)}</span>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        </div>
      </main>

      {dragging && (
        <div className="pointer-events-none fixed inset-4 z-50 flex items-center justify-center rounded-3xl border-2 border-dashed border-indigo-400 bg-indigo-50/95 text-center shadow-2xl backdrop-blur">
          <div>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm">
              <Upload size={28} />
            </div>
            <p className="mt-4 text-lg font-medium text-slate-900">Отпустите файлы для загрузки</p>
            <p className="mt-1 text-sm text-slate-500">Изображения, видео или PDF</p>
          </div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-5">
          <button type="button" className="absolute inset-0" onClick={() => setPreview(null)} aria-label="Закрыть просмотр" />
          <div className="relative grid max-h-[94dvh] w-full max-w-5xl overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:grid-cols-[minmax(0,1fr)_300px] sm:rounded-3xl">
            <div className="flex min-h-[280px] items-center justify-center overflow-hidden bg-[#111318] sm:min-h-[620px]">
              {preview.type === 'image' ? (
                <img src={preview.url} alt={preview.name} className="max-h-[70dvh] max-w-full object-contain sm:max-h-[82dvh]" />
              ) : preview.type === 'video' ? (
                <video src={preview.url} controls autoPlay playsInline className="max-h-[70dvh] max-w-full sm:max-h-[82dvh]" />
              ) : (
                <iframe src={preview.url} title={preview.name} className="h-[60dvh] w-full bg-white sm:h-[82dvh]" />
              )}
            </div>

            <aside className="max-h-[42dvh] overflow-y-auto p-5 sm:max-h-[82dvh]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="inline-flex rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500">
                    {preview.type === 'image' ? 'Изображение' : preview.type === 'video' ? 'Видео' : 'PDF'}
                  </span>
                  <h2 className="mt-3 break-words text-base font-medium leading-6 text-slate-900">{preview.name}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"
                  aria-label="Закрыть"
                >
                  <X size={18} />
                </button>
              </div>

              <dl className="mt-6 space-y-3 border-y border-slate-100 py-4 text-xs">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Размер</dt>
                  <dd className="text-right text-slate-700">{formatBytes(preview.size)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Добавлен</dt>
                  <dd className="text-right text-slate-700">{formatDate(preview.createdAt)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Источник</dt>
                  <dd className="text-right text-slate-700">{sourceLabel(preview.source)}</dd>
                </div>
              </dl>

              <div className="mt-5">
                <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-slate-400">Использование</p>
                {preview.usedIn.length > 0 ? (
                  <div className="mt-2 space-y-1.5">
                    {preview.usedIn.map(funnel => (
                      <div key={funnel.id} className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                        {funnel.title}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs leading-5 text-slate-500">Файл пока не используется в сохранённых воронках.</p>
                )}
              </div>

              <div className="mt-6 grid gap-2">
                <button
                  type="button"
                  onClick={() => copyLinks([preview.url])}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm text-white hover:bg-slate-800"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Ссылка скопирована' : 'Скопировать ссылку'}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={preview.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    <ExternalLink size={14} />
                    Открыть
                  </a>
                  <a
                    href={preview.url}
                    download={preview.name}
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    <Download size={14} />
                    Скачать
                  </a>
                </div>
                {preview.source !== 'project' && (
                  <button
                    type="button"
                    onClick={() => setDeleteTarget([preview])}
                    disabled={preview.usedIn.length > 0}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-rose-200 text-sm text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                    title={preview.usedIn.length > 0 ? 'Сначала удалите файл из воронки' : undefined}
                  >
                    <Trash2 size={15} />
                    {preview.usedIn.length > 0 ? 'Используется в воронке' : 'Удалить файл'}
                  </button>
                )}
              </div>
            </aside>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0"
            onClick={() => !deleting && setDeleteTarget(null)}
            aria-label="Отменить удаление"
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <AlertTriangle size={20} />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">
              {deleteTarget.length === 1 ? 'Удалить файл?' : `Удалить файлы (${deleteTarget.filter(item => item.source !== 'project' && item.usedIn.length === 0).length})?`}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Файлы будут удалены из хранилища без возможности восстановления.
            </p>
            {deleteTarget.length === 1 && (
              <p className="mt-3 truncate rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600" title={deleteTarget[0].name}>
                {deleteTarget[0].name}
              </p>
            )}
            {deleteTarget.some(item => item.source === 'project' || item.usedIn.length > 0) && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                {deleteTarget.filter(item => item.source === 'project' || item.usedIn.length > 0).length} файл(а) защищены и будут пропущены: они входят в проект или используются в воронках.
              </p>
            )}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="h-10 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={deleteItems}
                disabled={deleting || deleteTarget.every(item => item.source === 'project' || item.usedIn.length > 0)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-rose-600 text-sm text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {deleting ? 'Удаляю…' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
