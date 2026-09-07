import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  ExternalLink,
  FileText,
  FolderKanban,
  Globe2,
  Plus,
  Settings2,
} from 'lucide-react';
import type { Funnel, FunnelSite, FunnelSitePage } from '../types/funnel';

interface SitesPageProps {
  funnels: Funnel[];
  onOpenFunnel: (id: string) => void;
  onCreateFunnel: () => void;
}

interface SiteView extends FunnelSite {
  pages: FunnelSitePage[];
  derived: boolean;
}

function pluralRu(value: number, one: string, few: string, many: string) {
  const mod10 = Math.abs(value) % 10;
  const mod100 = Math.abs(value) % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function linkedSitesText(value: number) {
  const noun = pluralRu(value, 'сайт', 'сайта', 'сайтов');
  const verb = value % 10 === 1 && value % 100 !== 11
    ? 'привязан'
    : value % 10 >= 2 && value % 10 <= 4 && (value % 100 < 12 || value % 100 > 14)
      ? 'привязаны'
      : 'привязано';
  return `${value} ${noun} ${verb} к этой воронке`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function getStagePages(funnel: Funnel): FunnelSitePage[] {
  const pages: FunnelSitePage[] = [];

  if (funnel.introWebApp?.enabled) {
    pages.push({
      id: `${funnel.id}-intro`,
      title: 'Главная',
      slug: '',
      stageId: 'intro',
      source: 'intro',
    });
  }

  for (const stage of funnel.stages || []) {
    if (!stage.webApp?.enabled) continue;
    pages.push({
      id: `${funnel.id}-${stage.id}`,
      title: stage.title || `Этап ${stage.index + 1}`,
      slug: slugify(stage.title || `stage-${stage.index + 1}`),
      stageId: stage.id,
      source: 'stage',
    });
  }

  return pages;
}

function getFunnelSites(funnel: Funnel): SiteView[] {
  const stagePages = getStagePages(funnel);

  if (funnel.sites?.length) {
    return funnel.sites.map((site, index) => ({
      ...site,
      isPrimary: site.isPrimary ?? index === 0,
      pages: site.pages?.length ? site.pages : (index === 0 ? stagePages : []),
      derived: false,
    }));
  }

  if (stagePages.length === 0) return [];

  return [{
    id: `${funnel.id}-primary-site`,
    title: funnel.title,
    slug: slugify(funnel.title) || funnel.id,
    isPrimary: true,
    pages: stagePages,
    derived: true,
  }];
}

function getPreviewUrl(funnelId: string, page: FunnelSitePage) {
  const params = new URLSearchParams({
    funnel: funnelId,
    stage: page.stageId || 'intro',
    preview: 'phone',
  });
  return `/?${params.toString()}`;
}

function getSiteAddress(site: SiteView, funnelId: string) {
  if (site.customDomain) return `https://${site.customDomain}`;
  if (typeof window === 'undefined') return `/?funnel=${funnelId}`;
  return `${window.location.origin}/?funnel=${encodeURIComponent(funnelId)}`;
}

export default function SitesPage({ funnels, onOpenFunnel, onCreateFunnel }: SitesPageProps) {
  const [selectedFunnelId, setSelectedFunnelId] = useState<string | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

  const sitesByFunnel: Map<string, SiteView[]> = useMemo(() => new Map<string, SiteView[]>(
    funnels.map(funnel => [funnel.id, getFunnelSites(funnel)] as [string, SiteView[]]),
  ), [funnels]);

  const selectedFunnel = funnels.find(funnel => funnel.id === selectedFunnelId) || null;
  const funnelSites = selectedFunnel ? sitesByFunnel.get(selectedFunnel.id) || [] : [];
  const selectedSite = funnelSites.find(site => site.id === selectedSiteId) || null;

  const openFunnelSites = (funnelId: string) => {
    setSelectedFunnelId(funnelId);
    setSelectedSiteId(null);
  };

  if (selectedFunnel && selectedSite) {
    return (
      <div className="admin-page min-w-0 flex-1 overflow-y-auto bg-[#f8f8fb] custom-scrollbar">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={() => setSelectedSiteId(null)}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm text-slate-500 transition hover:bg-white hover:text-slate-800"
              >
                <ArrowLeft size={17} />
                Все сайты воронки
              </button>
              <button
                onClick={() => onOpenFunnel(selectedFunnel.id)}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300"
              >
                <Settings2 size={16} />
                Настроить воронку
                {selectedSite.isPrimary && (
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">Основной</span>
                )}
              </button>
            </div>

            <header className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <FileText size={23} />
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl font-semibold tracking-[-0.025em] text-slate-900">Страницы</h1>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {selectedSite.pages.length} {pluralRu(selectedSite.pages.length, 'страница', 'страницы', 'страниц')}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    Страницы сайта «{selectedSite.title}» принадлежат воронке «{selectedFunnel.title}».
                  </p>
                </div>
              </div>
            </header>
          </div>

          <div className="mt-5 grid gap-3">
            {selectedSite.pages.map((page, index) => (
              <article
                key={page.id}
                className="group flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 sm:flex-row sm:items-center sm:p-5"
              >
                <button
                  onClick={() => onOpenFunnel(selectedFunnel.id)}
                  className="flex min-w-0 flex-1 items-center gap-4 text-left"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-600">
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-medium text-slate-900">{page.title}</span>
                    <span className="mt-1 block truncate text-xs text-slate-400">
                      {page.slug ? `/${page.slug}` : '/'}
                      {' · '}
                      {page.source === 'intro'
                        ? 'главный экран воронки'
                        : page.stageId
                          ? `этап «${selectedFunnel.stages?.find(stage => stage.id === page.stageId)?.title || page.stageId}»`
                          : 'отдельная страница'}
                    </span>
                  </span>
                </button>
                <div className="flex items-center gap-2 sm:shrink-0">
                  <a
                    href={getPreviewUrl(selectedFunnel.id, page)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition hover:border-blue-200 hover:text-[#1677e8] sm:flex-none"
                  >
                    <ExternalLink size={15} />
                    Открыть
                  </a>
                  <button
                    onClick={() => onOpenFunnel(selectedFunnel.id)}
                    aria-label={`Настроить страницу ${page.title}`}
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    <Settings2 size={17} />
                  </button>
                </div>
              </article>
            ))}

            {selectedSite.pages.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <FileText className="mx-auto text-slate-300" size={30} />
                <h2 className="mt-3 text-base font-medium text-slate-800">Страниц пока нет</h2>
                <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
                  Добавьте Web App к этапу воронки — страница автоматически появится здесь.
                </p>
              </div>
            )}

            <button
              onClick={() => onOpenFunnel(selectedFunnel.id)}
              className="flex min-h-20 items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-5 text-sm font-medium text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-[#1677e8]"
            >
              <Plus size={18} />
              Новая страница в этой воронке
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (selectedFunnel) {
    return (
      <div className="admin-page min-w-0 flex-1 overflow-y-auto bg-[#f8f8fb] custom-scrollbar">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
          <button
            onClick={() => {
              setSelectedFunnelId(null);
              setSelectedSiteId(null);
            }}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm text-slate-500 transition hover:bg-white hover:text-slate-800"
          >
            <ArrowLeft size={17} />
            Все воронки
          </button>

          <header className="mt-3 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div className="flex min-w-0 items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#1677e8]">
                  <Globe2 size={23} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">Воронка</div>
                  <h1 className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-slate-900">{selectedFunnel.title}</h1>
                  <p className="mt-1 text-sm text-slate-500">{linkedSitesText(funnelSites.length)}</p>
                </div>
              </div>
              <button
                onClick={() => onOpenFunnel(selectedFunnel.id)}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300"
              >
                <Settings2 size={16} />
                Настроить воронку
              </button>
            </div>
          </header>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {funnelSites.map(site => (
              <article
                key={site.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
              >
                <button
                  onClick={() => setSelectedSiteId(site.id)}
                  className="block w-full text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                      <Globe2 size={21} />
                    </div>
                    {site.isPrimary && (
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                        Основной
                      </span>
                    )}
                  </div>
                  <h2 className="mt-4 truncate text-base font-medium text-slate-900">{site.title}</h2>
                  <p className="mt-1 truncate text-xs text-slate-400">{getSiteAddress(site, selectedFunnel.id)}</p>
                  <p className="mt-3 text-xs text-slate-500">
                    {site.pages.length} {pluralRu(site.pages.length, 'страница', 'страницы', 'страниц')}
                  </p>
                </button>
                <div className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-4">
                  <button
                    onClick={() => setSelectedSiteId(site.id)}
                    className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:border-blue-200 hover:text-[#1677e8]"
                  >
                    Открыть
                    <ArrowRight size={15} />
                  </button>
                  <button
                    onClick={() => onOpenFunnel(selectedFunnel.id)}
                    aria-label={`Настроить сайт ${site.title}`}
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    <Settings2 size={17} />
                  </button>
                </div>
              </article>
            ))}

            <button
              onClick={() => onOpenFunnel(selectedFunnel.id)}
              className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500 transition hover:border-blue-300 hover:bg-blue-50 hover:text-[#1677e8]"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
                <Plus size={22} />
              </span>
              <span className="mt-3 text-sm font-medium">Новый сайт для этой воронки</span>
              <span className="mt-1 max-w-xs text-xs leading-5 text-slate-400">
                Добавьте Web App-страницы в настройках этапов
              </span>
            </button>
          </div>

          {funnelSites.length === 0 && (
            <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-slate-600">
              У этой воронки пока нет сайта. Сайт появится здесь, когда вы включите Web App хотя бы у одной страницы или этапа.
            </div>
          )}
        </div>
      </div>
    );
  }

  const totalSites = funnels.reduce(
    (sum, funnel) => sum + (sitesByFunnel.get(funnel.id)?.length || 0),
    0,
  );

  return (
    <div className="admin-page min-w-0 flex-1 overflow-y-auto bg-[#f8f8fb] custom-scrollbar">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#1677e8]">
                <FolderKanban size={23} />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-[-0.025em] text-slate-900">Сайты по воронкам</h1>
                <p className="mt-1 text-sm text-slate-500">
                  {totalSites} {pluralRu(totalSites, 'сайт', 'сайта', 'сайтов')} в {funnels.length} {pluralRu(funnels.length, 'воронке', 'воронках', 'воронках')}
                </p>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                  Сайт — это те же страницы этапов воронки, только открытые в браузере, а не внутри Telegram.
                  Отдельного контента здесь нет: правится всё в этапах, а сюда попадает готовый результат,
                  которым можно поделиться ссылкой — в рекламе, в шапке профиля, в переписке.
                </p>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  Выберите воронку — внутри будут только её страницы.
                </p>
              </div>
            </div>
            <button
              onClick={onCreateFunnel}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1677e8] px-4 text-sm font-medium text-white shadow-sm transition hover:bg-[#0f69ce]"
            >
              <Plus size={17} />
              Новая воронка
            </button>
          </div>
        </header>

        {funnels.length > 0 ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {funnels.map(funnel => {
              const sites = sitesByFunnel.get(funnel.id) || [];
              const pageCount = sites.reduce((sum, site) => sum + site.pages.length, 0);
              return (
                <button
                  key={funnel.id}
                  onClick={() => openFunnelSites(funnel.id)}
                  className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition group-hover:bg-blue-50 group-hover:text-[#1677e8]">
                      <Bot size={21} />
                    </div>
                    <span className={`rounded-md px-2 py-1 text-[11px] font-medium ${
                      funnel.status === 'active'
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {funnel.status === 'active' ? 'Запущена' : funnel.status === 'archived' ? 'Архив' : 'Черновик'}
                    </span>
                  </div>
                  <h2 className="mt-4 line-clamp-2 min-h-12 text-base font-medium leading-6 text-slate-900">{funnel.title}</h2>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div className="text-lg font-semibold text-slate-800">{sites.length}</div>
                      <div className="mt-0.5 text-xs text-slate-400">{pluralRu(sites.length, 'сайт', 'сайта', 'сайтов')}</div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div className="text-lg font-semibold text-slate-800">{pageCount}</div>
                      <div className="mt-0.5 text-xs text-slate-400">{pluralRu(pageCount, 'страница', 'страницы', 'страниц')}</div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-sm font-medium text-slate-600">
                    Открыть сайты
                    <ArrowRight size={17} className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-[#1677e8]" />
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center sm:p-12">
            <FolderKanban className="mx-auto text-slate-300" size={34} />
            <h2 className="mt-4 text-lg font-medium text-slate-800">Сначала создайте воронку</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Сайты всегда принадлежат конкретной воронке, поэтому отдельного общего каталога здесь больше нет.
            </p>
            <button
              onClick={onCreateFunnel}
              className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1677e8] px-5 text-sm font-medium text-white transition hover:bg-[#0f69ce]"
            >
              <Plus size={17} />
              Создать воронку
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
