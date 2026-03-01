'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { downloadCsv } from '@/lib/exportCsv';
import { useToast } from '@/components/ui/Toast';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  propertyType: string | null;
  estimatedValue: number | null;
  equityPercent: number | null;
  debtOwed: number | null;
  interestRate: number | null;
  daysOnMarket: number | null;
  dataFreshnessDate: string;
  distressSignals: Record<string, unknown>;
  ownershipName: string | null;
  isStale: boolean;
}

interface PropertyDetail {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  propertyType: string | null;
  estimatedValue: number | null;
  equityPercent: number | null;
  debtOwed: number | null;
  interestRate: number | null;
  daysOnMarket: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  squareFootage: number | null;
  lotSize: number | null;
  yearBuilt: number | null;
  lastSalePrice: number | null;
}

interface SearchResult {
  properties: Property[];
  total: number;
  page: number;
  hasMore: boolean;
}

interface SavedFilter {
  id: string;
  name: string;
  filters: Record<string, unknown>;
  createdAt: string;
}

interface FilterState {
  minEquity: string;
  maxDebt: string;
  minDays: string;
  maxDays: string;
  maxRate: string;
  q: string;
  city: string;
  state: string;
  propertyType: string;
  distress: string[];
}

const EMPTY_FILTERS: FilterState = {
  minEquity: '',
  maxDebt: '',
  minDays: '',
  maxDays: '',
  maxRate: '',
  q: '',
  city: '',
  state: '',
  propertyType: '',
  distress: [],
};

const DISTRESS_OPTIONS = [
  { key: 'foreclosure', label: 'Foreclosure' },
  { key: 'preforeclosure', label: 'Pre-Foreclosure' },
  { key: 'taxLien', label: 'Tax Lien' },
  { key: 'probate', label: 'Probate' },
  { key: 'divorce', label: 'Divorce' },
  { key: 'vacant', label: 'Vacant' },
  { key: 'auction', label: 'Auction' },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—';
  return '$' + value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatPercent(value: number | null | undefined): string {
  if (value == null) return '—';
  return value.toFixed(1) + '%';
}

function dataAgeText(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function dataAgeDays(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function dataAgeHuman(dateStr: string): string {
  const days = dataAgeDays(dateStr);
  if (days < 30) return `Updated ${days} days ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return 'Updated 1 month ago';
  if (months < 12) return `Updated ${months} months ago`;
  const years = Math.floor(months / 12);
  if (years === 1) return 'Updated 1 year ago';
  return `Updated ${years} years ago`;
}

const STALE_THRESHOLD_DAYS = 90;

function buildSearchParams(filters: FilterState, page: number): string {
  const params = new URLSearchParams();
  if (filters.minEquity) params.set('minEquity', filters.minEquity);
  if (filters.maxDebt) params.set('maxDebt', filters.maxDebt);
  if (filters.minDays) params.set('minDays', filters.minDays);
  if (filters.maxDays) params.set('maxDays', filters.maxDays);
  if (filters.maxRate) params.set('maxRate', filters.maxRate);
  if (filters.q) params.set('q', filters.q);
  if (filters.city) params.set('city', filters.city);
  if (filters.state) params.set('state', filters.state);
  if (filters.propertyType) params.set('propertyType', filters.propertyType);
  if (filters.distress.length > 0) params.set('distress', filters.distress.join(','));
  params.set('page', String(page));
  params.set('limit', '50');
  return params.toString();
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function PropertiesPage() {
  const { toast } = useToast();
  const [properties, setProperties] = useState<Property[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [selectedSavedFilter, setSelectedSavedFilter] = useState<string>('');
  const [isSavingFilter, setIsSavingFilter] = useState(false);
  const [saveFilterName, setSaveFilterName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [deletingFilterId, setDeletingFilterId] = useState<string | null>(null);

  // Track deal creation per property
  const [creatingDealFor, setCreatingDealFor] = useState<string | null>(null);
  const [dealCreatedFor, setDealCreatedFor] = useState<Record<string, string>>({});

  // Property comparison
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [compareProperties, setCompareProperties] = useState<PropertyDetail[]>([]);
  const [isLoadingCompare, setIsLoadingCompare] = useState(false);

  // Quick-add deal modal (Task 8)
  const [quickDealProperty, setQuickDealProperty] = useState<Property | null>(null);
  const [quickDealTitle, setQuickDealTitle] = useState('');
  const [isCreatingQuickDeal, setIsCreatingQuickDeal] = useState(false);

  // Duplicate detection
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [duplicateGroupCount, setDuplicateGroupCount] = useState(0);
  const [showDuplicatesAlert, setShowDuplicatesAlert] = useState(true);

  // Stale data refresh
  const [showStaleOnly, setShowStaleOnly] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  // ── Fetch duplicates ──────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/properties/duplicates')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setDuplicateCount(data.totalDuplicates ?? 0);
          setDuplicateGroupCount(data.duplicateGroups?.length ?? 0);
        }
      })
      .catch(() => {});
  }, []);

  // ── Fetch saved filters ──────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/search-filters')
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setSavedFilters(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // ── Fetch properties ─────────────────────────────────────────────────────────

  const fetchProperties = useCallback(async (currentFilters: FilterState, currentPage: number, append: boolean) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    if (!append) setError(null);

    try {
      const qs = buildSearchParams(currentFilters, currentPage);
      const res = await fetch(`/api/properties/search?${qs}`, { signal: controller.signal });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to load properties' }));
        setError(err.error ?? 'Failed to load properties');
        return;
      }
      const data: SearchResult = await res.json();
      setTotal(data.total);
      setHasMore(data.hasMore);
      if (append) {
        setProperties((prev) => [...prev, ...data.properties]);
      } else {
        setProperties(data.properties);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError('Network error — could not load properties');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchProperties(filters, 1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Filter handling ──────────────────────────────────────────────────────────

  function handleFilterChange(field: keyof FilterState, value: string) {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }

  function handleApplyFilters() {
    setPage(1);
    fetchProperties(filters, 1, false);
    setSelectedSavedFilter('');
  }

  function handleClearFilters() {
    setFilters(EMPTY_FILTERS);
    setSelectedSavedFilter('');
    setPage(1);
    fetchProperties(EMPTY_FILTERS, 1, false);
  }

  function handleLoadSavedFilter(filterId: string) {
    const found = savedFilters.find((f) => f.id === filterId);
    if (!found) return;
    setSelectedSavedFilter(filterId);

    const f = found.filters as Partial<{
      minEquityPercent: number;
      maxDebtOwed: number;
      minDaysOnMarket: number;
      maxDaysOnMarket: number;
      maxInterestRate: number;
    }>;

    const newFilters: FilterState = {
      minEquity: f.minEquityPercent != null ? String(f.minEquityPercent) : '',
      maxDebt: f.maxDebtOwed != null ? String(f.maxDebtOwed) : '',
      minDays: f.minDaysOnMarket != null ? String(f.minDaysOnMarket) : '',
      maxDays: f.maxDaysOnMarket != null ? String(f.maxDaysOnMarket) : '',
      maxRate: f.maxInterestRate != null ? String(f.maxInterestRate) : '',
      q: '',
      city: '',
      state: '',
      propertyType: '',
      distress: [],
    };
    setFilters(newFilters);
    setPage(1);
    fetchProperties(newFilters, 1, false);
  }

  async function handleSaveFilter() {
    if (!saveFilterName.trim()) return;
    setIsSavingFilter(true);

    const filterBody: Record<string, number> = {};
    if (filters.minEquity) filterBody.minEquityPercent = parseFloat(filters.minEquity);
    if (filters.maxDebt) filterBody.maxDebtOwed = parseFloat(filters.maxDebt);
    if (filters.minDays) filterBody.minDaysOnMarket = parseFloat(filters.minDays);
    if (filters.maxDays) filterBody.maxDaysOnMarket = parseFloat(filters.maxDays);
    if (filters.maxRate) filterBody.maxInterestRate = parseFloat(filters.maxRate);

    try {
      const res = await fetch('/api/search-filters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: saveFilterName.trim(), filters: filterBody }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to save filter' }));
        toast(err.error ?? 'Failed to save filter', 'error');
        return;
      }
      const newFilter: SavedFilter = await res.json();
      setSavedFilters((prev) => [newFilter, ...prev]);
      setSelectedSavedFilter(newFilter.id);
      setShowSaveDialog(false);
      setSaveFilterName('');
    } catch {
      toast('Network error — could not save filter', 'error');
    } finally {
      setIsSavingFilter(false);
    }
  }

  // ── Delete Saved Filter ──────────────────────────────────────────────────────

  async function handleDeleteSavedFilter(filterId: string) {
    setDeletingFilterId(filterId);
    try {
      const res = await fetch(`/api/search-filters/${filterId}`, { method: 'DELETE' });
      if (res.ok) {
        setSavedFilters((prev) => prev.filter((f) => f.id !== filterId));
        if (selectedSavedFilter === filterId) {
          setSelectedSavedFilter('');
        }
      }
    } catch {
      // Silent fail
    } finally {
      setDeletingFilterId(null);
    }
  }

  // ── Load More ────────────────────────────────────────────────────────────────

  function handleLoadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchProperties(filters, nextPage, true);
  }

  // ── Create Deal ──────────────────────────────────────────────────────────────

  async function handleCreateDeal(property: Property) {
    setCreatingDealFor(property.id);
    try {
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: property.id,
          title: property.address,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.dealId) {
          setDealCreatedFor((prev) => ({ ...prev, [property.id]: data.dealId }));
          return;
        }
        toast(data.error ?? 'Failed to create deal', 'error');
        return;
      }
      setDealCreatedFor((prev) => ({ ...prev, [property.id]: data.id }));
    } catch {
      toast('Network error — could not create deal', 'error');
    } finally {
      setCreatingDealFor(null);
    }
  }

  // ── Property comparison ─────────────────────────────────────────────────────

  function togglePropertySelection(propertyId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(propertyId)) {
        next.delete(propertyId);
      } else {
        if (next.size >= 3) return prev; // max 3
        next.add(propertyId);
      }
      return next;
    });
  }

  async function handleCompare() {
    if (selectedIds.size < 2) return;
    setIsLoadingCompare(true);
    setShowCompareModal(true);
    try {
      const details = await Promise.all(
        Array.from(selectedIds).map(async (pid) => {
          const res = await fetch(`/api/properties/${pid}`);
          if (!res.ok) throw new Error('Failed to load property');
          return res.json() as Promise<PropertyDetail>;
        })
      );
      setCompareProperties(details);
    } catch {
      toast('Failed to load property details for comparison', 'error');
      setShowCompareModal(false);
    } finally {
      setIsLoadingCompare(false);
    }
  }

  // ── Quick-add deal modal ──────────────────────────────────────────────────

  function openQuickDealModal(property: Property) {
    setQuickDealProperty(property);
    setQuickDealTitle(`Deal - ${property.address}`);
  }

  async function handleQuickCreateDeal() {
    if (!quickDealProperty) return;
    setIsCreatingQuickDeal(true);
    try {
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: quickDealProperty.id,
          title: quickDealTitle.trim() || quickDealProperty.address,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.dealId) {
          setDealCreatedFor((prev) => ({ ...prev, [quickDealProperty.id]: data.dealId }));
          toast('A deal already exists for this property', 'info');
        } else {
          toast(data.error ?? 'Failed to create deal', 'error');
        }
        return;
      }
      setDealCreatedFor((prev) => ({ ...prev, [quickDealProperty.id]: data.id }));
      toast('Deal created successfully', 'success');
      setQuickDealProperty(null);
    } catch {
      toast('Network error — could not create deal', 'error');
    } finally {
      setIsCreatingQuickDeal(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const hasActiveFilters = Object.entries(filters).some(([k, v]) => {
    if (k === 'distress') return (v as string[]).length > 0;
    return v !== '';
  });

  const staleCount = properties.filter((p) => p.isStale).length;
  const stale90Count = properties.filter((p) => dataAgeDays(p.dataFreshnessDate) > STALE_THRESHOLD_DAYS).length;
  const displayedProperties = showStaleOnly
    ? properties.filter((p) => dataAgeDays(p.dataFreshnessDate) > STALE_THRESHOLD_DAYS)
    : properties;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-screen-xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Properties</h1>
            {!isLoading && (
              <p className="mt-1 text-sm text-gray-500">
                {total.toLocaleString()} properties found
                {staleCount > 0 && (
                  <span className="ml-2 text-amber-600 font-medium">
                    ({staleCount} with stale data)
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="flex gap-3 self-start">
            <button
              onClick={() => {
                const rows = properties.map((p) => ({
                  address: p.address,
                  city: p.city,
                  state: p.state,
                  zip: p.zip,
                  propertyType: p.propertyType ?? '',
                  estimatedValue: p.estimatedValue ?? '',
                  equityPercent: p.equityPercent ?? '',
                  debtOwed: p.debtOwed ?? '',
                  interestRate: p.interestRate ?? '',
                  daysOnMarket: p.daysOnMarket ?? '',
                  owner: p.ownershipName ?? '',
                  dataFreshness: p.dataFreshnessDate,
                }));
                downloadCsv(rows, `properties-export-${new Date().toISOString().slice(0, 10)}.csv`);
              }}
              disabled={properties.length === 0}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-colors disabled:opacity-40"
            >
              Export CSV
            </button>
            <Link
              href="/import"
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
            >
              Import CSV
            </Link>
          </div>
        </div>

        {/* ── Search Bar ──────────────────────────────────────────────────── */}
        <div className="mb-4">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={filters.q}
              onChange={(e) => handleFilterChange('q', e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
              placeholder="Search by address, city, zip, or owner name..."
              className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 py-3 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* ── Filter Bar ─────────────────────────────────────────────────── */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white shadow-sm p-4">
          {/* Location & Type filters */}
          <div className="grid gap-3 sm:grid-cols-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">City</label>
              <input
                type="text"
                value={filters.city}
                onChange={(e) => handleFilterChange('city', e.target.value)}
                placeholder="e.g. Miami"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">State</label>
              <input
                type="text"
                value={filters.state}
                onChange={(e) => handleFilterChange('state', e.target.value)}
                placeholder="e.g. FL"
                maxLength={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Property Type</label>
              <input
                type="text"
                value={filters.propertyType}
                onChange={(e) => handleFilterChange('propertyType', e.target.value)}
                placeholder="e.g. Single Family"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          {/* Numeric filters */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Min Equity %</label>
              <input
                type="number"
                min="0"
                max="100"
                step="5"
                value={filters.minEquity}
                onChange={(e) => handleFilterChange('minEquity', e.target.value)}
                placeholder="e.g. 30"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Max Debt ($)</label>
              <input
                type="number"
                min="0"
                step="10000"
                value={filters.maxDebt}
                onChange={(e) => handleFilterChange('maxDebt', e.target.value)}
                placeholder="e.g. 150000"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Min Days on Market</label>
              <input
                type="number"
                min="0"
                step="30"
                value={filters.minDays}
                onChange={(e) => handleFilterChange('minDays', e.target.value)}
                placeholder="e.g. 60"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Max Days on Market</label>
              <input
                type="number"
                min="0"
                step="30"
                value={filters.maxDays}
                onChange={(e) => handleFilterChange('maxDays', e.target.value)}
                placeholder="e.g. 365"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Max Interest Rate %</label>
              <input
                type="number"
                min="0"
                max="30"
                step="0.5"
                value={filters.maxRate}
                onChange={(e) => handleFilterChange('maxRate', e.target.value)}
                placeholder="e.g. 7.5"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Distress signal filter chips */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-2">Distress Signals</label>
            <div className="flex flex-wrap gap-2">
              {DISTRESS_OPTIONS.map((opt) => {
                const isActive = filters.distress.includes(opt.key);
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => {
                      setFilters((prev) => ({
                        ...prev,
                        distress: isActive
                          ? prev.distress.filter((d) => d !== opt.key)
                          : [...prev.distress, opt.key],
                      }));
                    }}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      isActive
                        ? 'border-red-300 bg-red-100 text-red-800'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filter actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleApplyFilters}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              Apply Filters
            </button>
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Clear
              </button>
            )}

            {/* Saved filters */}
            {savedFilters.length > 0 && (
              <div className="flex items-center gap-1">
                <select
                  value={selectedSavedFilter}
                  onChange={(e) => handleLoadSavedFilter(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none bg-white"
                >
                  <option value="">Load saved filter...</option>
                  {savedFilters.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                {selectedSavedFilter && (
                  <button
                    onClick={() => handleDeleteSavedFilter(selectedSavedFilter)}
                    disabled={deletingFilterId === selectedSavedFilter}
                    className="rounded p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Delete saved filter"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            )}

            {/* Save current filter */}
            {hasActiveFilters && (
              <div className="flex items-center gap-2">
                {showSaveDialog ? (
                  <>
                    <input
                      type="text"
                      value={saveFilterName}
                      onChange={(e) => setSaveFilterName(e.target.value)}
                      placeholder="Filter name..."
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none w-36"
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveFilter()}
                    />
                    <button
                      onClick={handleSaveFilter}
                      disabled={!saveFilterName.trim() || isSavingFilter}
                      className="rounded-lg bg-gray-800 px-3 py-2 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
                    >
                      {isSavingFilter ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => { setShowSaveDialog(false); setSaveFilterName(''); }}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setShowSaveDialog(true)}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Save Filter
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Duplicates Alert ──────────────────────────────────────────── */}
        {duplicateCount > 0 && showDuplicatesAlert && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    {duplicateCount} potential duplicate {duplicateCount === 1 ? 'property' : 'properties'} found
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    {duplicateGroupCount} {duplicateGroupCount === 1 ? 'group' : 'groups'} of properties share the same normalized address.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDuplicatesAlert(false)}
                className="rounded p-1 text-amber-500 hover:text-amber-700 hover:bg-amber-100 transition-colors"
                title="Dismiss"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ── Stale Data Banner ───────────────────────────────────────────── */}
        {!isLoading && stale90Count > 0 && (
          <div className="mb-4 rounded-lg border border-orange-300 bg-orange-50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-orange-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-semibold text-orange-800">
                  {stale90Count} {stale90Count === 1 ? 'property has' : 'properties have'} data older than 90 days
                </p>
              </div>
              {showStaleOnly ? (
                <button
                  onClick={() => setShowStaleOnly(false)}
                  className="rounded-lg border border-orange-300 bg-white px-4 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-100 transition-colors"
                >
                  Show All Properties
                </button>
              ) : (
                <button
                  onClick={() => setShowStaleOnly(true)}
                  className="rounded-lg bg-orange-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-orange-700 transition-colors"
                >
                  Review Stale
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Error state ─────────────────────────────────────────────────── */}
        {error && !isLoading && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            <p className="font-medium">Failed to load properties</p>
            <p className="mt-1 text-sm">{error}</p>
            <button
              onClick={() => fetchProperties(filters, page, false)}
              className="mt-2 text-sm text-red-600 underline hover:text-red-800"
            >
              Try again
            </button>
          </div>
        )}

        {/* ── Loading skeleton ────────────────────────────────────────────── */}
        {isLoading && properties.length === 0 && (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-200"></div>
            ))}
          </div>
        )}

        {/* ── Empty state ─────────────────────────────────────────────────── */}
        {!isLoading && !error && properties.length === 0 && !showStaleOnly && (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
            <p className="text-gray-500 font-medium">No properties found</p>
            {hasActiveFilters ? (
              <p className="mt-1 text-sm text-gray-400">Try adjusting your filters.</p>
            ) : (
              <>
                <p className="mt-1 text-sm text-gray-400">
                  Import a PropStream CSV to get started.
                </p>
                <Link
                  href="/import"
                  className="mt-4 inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                >
                  Import CSV
                </Link>
              </>
            )}
          </div>
        )}

        {/* ── Stale filter active indicator ──────────────────────────────── */}
        {showStaleOnly && (
          <div className="mb-4 text-sm text-orange-700 font-medium">
            Showing {displayedProperties.length} stale {displayedProperties.length === 1 ? 'property' : 'properties'} (data older than 90 days)
          </div>
        )}

        {/* ── Properties table ────────────────────────────────────────────── */}
        {displayedProperties.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 w-10">
                      <span className="sr-only">Select</span>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Address</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">City / State</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Est. Value</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Equity %</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Debt Owed</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Days Listed</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Signals / Age</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {displayedProperties.map((property) => {
                    const dealId = dealCreatedFor[property.id];
                    const isCreating = creatingDealFor === property.id;

                    return (
                      <tr key={property.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => window.location.href = `/properties/${property.id}`}>
                        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(property.id)}
                            onChange={() => togglePropertySelection(property.id)}
                            disabled={!selectedIds.has(property.id) && selectedIds.size >= 3}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/properties/${property.id}`} className="font-medium text-gray-900 leading-tight hover:text-blue-600">{property.address}</Link>
                          {property.ownershipName && (
                            <p className="text-xs text-gray-400 mt-0.5">{property.ownershipName}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {property.city}, {property.state}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900 font-medium">
                          {formatCurrency(property.estimatedValue)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {property.equityPercent != null ? (
                            <span
                              className={`font-semibold ${
                                property.equityPercent >= 30 ? 'text-green-700' : 'text-gray-700'
                              }`}
                            >
                              {formatPercent(property.equityPercent)}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {formatCurrency(property.debtOwed)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {property.daysOnMarket != null ? property.daysOnMarket : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {Object.entries(property.distressSignals).filter(([, v]) => v === true).length > 0 && (
                              <span className="inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700" title={Object.entries(property.distressSignals).filter(([, v]) => v === true).map(([k]) => k).join(', ')}>
                                {Object.entries(property.distressSignals).filter(([, v]) => v === true).length}
                              </span>
                            )}
                            <span
                              className={`text-xs font-medium ${
                                dataAgeDays(property.dataFreshnessDate) > STALE_THRESHOLD_DAYS
                                  ? 'text-red-600'
                                  : property.isStale
                                  ? 'text-amber-600'
                                  : 'text-gray-500'
                              }`}
                              title={dataAgeDays(property.dataFreshnessDate) > STALE_THRESHOLD_DAYS ? dataAgeHuman(property.dataFreshnessDate) : undefined}
                            >
                              {dataAgeDays(property.dataFreshnessDate) > STALE_THRESHOLD_DAYS
                                ? dataAgeHuman(property.dataFreshnessDate)
                                : dataAgeText(property.dataFreshnessDate)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            {dealId ? (
                              <Link
                                href={`/deals/${dealId}`}
                                className="inline-flex items-center rounded bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-800 hover:bg-green-200 transition-colors"
                              >
                                View Deal
                              </Link>
                            ) : (
                              <>
                                <button
                                  onClick={() => openQuickDealModal(property)}
                                  title="Create Deal"
                                  className="inline-flex items-center justify-center rounded bg-blue-50 p-1.5 text-blue-600 hover:bg-blue-100 transition-colors"
                                >
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleCreateDeal(property)}
                                  disabled={isCreating}
                                  className="inline-flex items-center rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                  {isCreating ? 'Creating...' : 'Create Deal'}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Load More */}
            {hasMore && (
              <div className="border-t border-gray-100 px-4 py-4 text-center">
                <button
                  onClick={handleLoadMore}
                  disabled={isLoading}
                  className="rounded-lg border border-gray-200 bg-white px-6 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  {isLoading ? 'Loading...' : `Load More (${total - properties.length} remaining)`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Floating Compare Button ───────────────────────────────── */}
        {selectedIds.size >= 2 && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40">
            <button
              onClick={handleCompare}
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Compare ({selectedIds.size})
            </button>
          </div>
        )}

        {/* ── Compare Modal ──────────────────────────────────────────── */}
        {showCompareModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowCompareModal(false)}>
            <div className="relative w-full max-w-4xl max-h-[85vh] overflow-auto rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 rounded-t-2xl">
                <h2 className="text-lg font-bold text-gray-900">Property Comparison</h2>
                <button
                  onClick={() => setShowCompareModal(false)}
                  className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="px-6 py-5">
                {isLoadingCompare ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                    <span className="ml-3 text-gray-500">Loading property details...</span>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide w-40">Field</th>
                        {compareProperties.map((p) => (
                          <th key={p.id} className="text-left py-2 px-2 text-xs font-semibold text-gray-900 max-w-[200px]">
                            <div className="truncate">{p.address}</div>
                            <div className="text-[10px] text-gray-400 font-normal">{p.city}, {p.state}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(() => {
                        const rows: { label: string; getValue: (p: PropertyDetail) => string | number | null; bestFn: 'highest' | 'lowest' | 'none' }[] = [
                          { label: 'Address', getValue: (p) => p.address, bestFn: 'none' },
                          { label: 'City / State', getValue: (p) => `${p.city}, ${p.state}`, bestFn: 'none' },
                          { label: 'Estimated Value', getValue: (p) => p.estimatedValue, bestFn: 'highest' },
                          { label: 'Equity %', getValue: (p) => p.equityPercent, bestFn: 'highest' },
                          { label: 'Beds', getValue: (p) => p.bedrooms, bestFn: 'highest' },
                          { label: 'Baths', getValue: (p) => p.bathrooms, bestFn: 'highest' },
                          { label: 'Sq Ft', getValue: (p) => p.squareFootage, bestFn: 'highest' },
                          { label: 'Lot Size', getValue: (p) => p.lotSize, bestFn: 'highest' },
                          { label: 'Year Built', getValue: (p) => p.yearBuilt, bestFn: 'highest' },
                          { label: 'Days on Market', getValue: (p) => p.daysOnMarket, bestFn: 'lowest' },
                          { label: 'Last Sale Price', getValue: (p) => p.lastSalePrice, bestFn: 'lowest' },
                        ];

                        function formatCompareValue(label: string, val: string | number | null): string {
                          if (val == null) return '--';
                          if (typeof val === 'string') return val;
                          if (label === 'Estimated Value' || label === 'Last Sale Price') return formatCurrency(val);
                          if (label === 'Equity %') return formatPercent(val);
                          if (label === 'Sq Ft' || label === 'Lot Size') return val.toLocaleString();
                          return String(val);
                        }

                        function findBestIndex(row: typeof rows[0]): number {
                          if (row.bestFn === 'none') return -1;
                          const values = compareProperties.map((p) => {
                            const v = row.getValue(p);
                            return typeof v === 'number' ? v : null;
                          });
                          const validValues = values.filter((v): v is number => v != null);
                          if (validValues.length === 0) return -1;
                          const target = row.bestFn === 'highest' ? Math.max(...validValues) : Math.min(...validValues);
                          return values.indexOf(target);
                        }

                        return rows.map((row) => {
                          const bestIdx = findBestIndex(row);
                          return (
                            <tr key={row.label}>
                              <td className="py-2.5 pr-4 text-xs font-medium text-gray-500">{row.label}</td>
                              {compareProperties.map((p, idx) => {
                                const val = row.getValue(p);
                                const isBest = idx === bestIdx;
                                return (
                                  <td
                                    key={p.id}
                                    className={`py-2.5 px-2 text-sm ${
                                      isBest ? 'font-bold text-green-700 bg-green-50 rounded' : 'text-gray-900'
                                    }`}
                                  >
                                    {formatCompareValue(row.label, val)}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Quick-Add Deal Modal ───────────────────────────────────── */}
        {quickDealProperty && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setQuickDealProperty(null)}>
            <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                <h2 className="text-lg font-bold text-gray-900">Create Deal</h2>
                <button
                  onClick={() => setQuickDealProperty(null)}
                  className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Property</label>
                  <p className="text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                    {quickDealProperty.address}, {quickDealProperty.city}, {quickDealProperty.state}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deal Title</label>
                  <input
                    type="text"
                    value={quickDealTitle}
                    onChange={(e) => setQuickDealTitle(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Enter deal title..."
                    onKeyDown={(e) => e.key === 'Enter' && handleQuickCreateDeal()}
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setQuickDealProperty(null)}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleQuickCreateDeal}
                    disabled={isCreatingQuickDeal}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {isCreatingQuickDeal ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
