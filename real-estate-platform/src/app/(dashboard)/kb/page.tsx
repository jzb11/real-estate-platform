'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

type KbCategory = 'ANALYSIS' | 'COMPLIANCE' | 'FORMULAS' | 'CREATIVE_FINANCE' | 'MARKET_TRENDS';

interface KbArticle {
  id: string;
  title: string;
  slug: string;
  category: KbCategory;
  viewCount: number;
  createdAt: string;
}

const CATEGORY_LABELS: Record<KbCategory, string> = {
  ANALYSIS: 'Analysis',
  COMPLIANCE: 'Compliance',
  FORMULAS: 'Formulas',
  CREATIVE_FINANCE: 'Creative Finance',
  MARKET_TRENDS: 'Market Trends',
};

const CATEGORY_COLORS: Record<KbCategory, string> = {
  ANALYSIS: 'bg-teal-100 text-teal-800',
  COMPLIANCE: 'bg-orange-100 text-orange-800',
  FORMULAS: 'bg-blue-100 text-blue-800',
  CREATIVE_FINANCE: 'bg-purple-100 text-purple-800',
  MARKET_TRENDS: 'bg-green-100 text-green-800',
};

type FilterTab = 'ALL' | KbCategory;

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'ANALYSIS', label: 'Analysis' },
  { value: 'FORMULAS', label: 'Formulas' },
  { value: 'CREATIVE_FINANCE', label: 'Creative Finance' },
  { value: 'COMPLIANCE', label: 'Compliance' },
];

export default function KbIndexPage() {
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [isSearching, setIsSearching] = useState(false);

  const fetchArticles = useCallback(async (category?: KbCategory) => {
    setLoading(true);
    try {
      const url = category
        ? `/api/kb/articles?category=${category}`
        : '/api/kb/articles';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch articles');
      const data = await res.json();
      setArticles(data.articles ?? []);
    } catch (err) {
      console.error('Error fetching articles:', err);
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const searchArticles = useCallback(async (query: string) => {
    if (query.length < 2) {
      fetchArticles(activeTab === 'ALL' ? undefined : activeTab as KbCategory);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/kb/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setArticles(data.results ?? []);
    } catch (err) {
      console.error('Error searching:', err);
    } finally {
      setIsSearching(false);
    }
  }, [activeTab, fetchArticles]);

  // Debounced search effect
  useEffect(() => {
    if (searchQuery.length === 0) {
      fetchArticles(activeTab === 'ALL' ? undefined : activeTab as KbCategory);
      return;
    }
    const timer = setTimeout(() => {
      searchArticles(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, activeTab, fetchArticles, searchArticles]);

  // Fetch articles when tab changes (and no search active)
  useEffect(() => {
    if (searchQuery.length === 0) {
      fetchArticles(activeTab === 'ALL' ? undefined : activeTab as KbCategory);
    }
  }, [activeTab, searchQuery, fetchArticles]);

  const handleTabClick = (tab: FilterTab) => {
    setActiveTab(tab);
    setSearchQuery('');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Knowledge Base</h1>
          <p className="mt-2 text-gray-600">
            Guides on deal analysis, creative finance structures, and compliance.
          </p>
        </div>

        {/* Search bar */}
        <div className="mb-6">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <svg
                className="h-5 w-5 text-gray-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search articles... (e.g. MAO, subject-to, TCPA)"
              className="block w-full rounded-lg border border-gray-300 bg-white py-3 pl-10 pr-4 text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {isSearching && (
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              </div>
            )}
          </div>
        </div>

        {/* Category tabs */}
        {!searchQuery && (
          <div className="mb-6 flex flex-wrap gap-2">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => handleTabClick(tab.value)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === tab.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Search context label */}
        {searchQuery.length >= 2 && (
          <div className="mb-4 text-sm text-gray-600">
            Showing results for{' '}
            <span className="font-semibold">&quot;{searchQuery}&quot;</span>
            {' '}({articles.length} found)
            <button
              onClick={() => setSearchQuery('')}
              className="ml-3 text-blue-600 hover:underline"
            >
              Clear search
            </button>
          </div>
        )}

        {/* Article grid */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse rounded-lg bg-white p-6 shadow-sm border border-gray-200">
                <div className="mb-3 h-4 w-20 rounded bg-gray-200" />
                <div className="mb-2 h-5 w-full rounded bg-gray-200" />
                <div className="h-4 w-16 rounded bg-gray-100" />
              </div>
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="rounded-lg bg-white p-12 text-center shadow-sm border border-gray-200">
            <p className="text-gray-500">
              {searchQuery.length >= 2
                ? `No articles found for "${searchQuery}"`
                : 'No articles available in this category.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {articles.map((article) => (
              <div
                key={article.id}
                className="rounded-lg bg-white p-6 shadow-sm border border-gray-200 hover:border-blue-300 hover:shadow transition-all"
              >
                <div className="mb-3">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      CATEGORY_COLORS[article.category]
                    }`}
                  >
                    {CATEGORY_LABELS[article.category]}
                  </span>
                </div>
                <h2 className="mb-3 text-base font-semibold text-gray-900">
                  {article.title}
                </h2>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    {article.viewCount} view{article.viewCount !== 1 ? 's' : ''}
                  </span>
                  <Link
                    href={`/kb/${article.slug}`}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    Read article &rarr;
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
