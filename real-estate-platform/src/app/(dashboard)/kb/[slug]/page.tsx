'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';

type KbCategory = 'ANALYSIS' | 'COMPLIANCE' | 'FORMULAS' | 'CREATIVE_FINANCE' | 'MARKET_TRENDS';

interface KbArticle {
  id: string;
  title: string;
  slug: string;
  category: KbCategory;
  content: string;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

interface RelatedArticle {
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

export default function KbArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [article, setArticle] = useState<KbArticle | null>(null);
  const [related, setRelated] = useState<RelatedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchArticle = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/kb/articles/${slug}`);
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error('Failed to fetch article');
        const data: KbArticle = await res.json();
        setArticle(data);

        // Fetch related articles in same category
        const relatedRes = await fetch(`/api/kb/articles?category=${data.category}`);
        if (relatedRes.ok) {
          const relatedData = await relatedRes.json();
          const filtered = (relatedData.articles ?? [])
            .filter((a: RelatedArticle) => a.slug !== slug)
            .slice(0, 3);
          setRelated(filtered);
        }
      } catch (err) {
        console.error('Error fetching article:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="mb-4 h-4 w-32 rounded bg-gray-200" />
            <div className="mb-6 h-8 w-3/4 rounded bg-gray-200" />
            <div className="mb-2 h-4 w-full rounded bg-gray-200" />
            <div className="mb-2 h-4 w-full rounded bg-gray-200" />
            <div className="mb-2 h-4 w-2/3 rounded bg-gray-200" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !article) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Article Not Found</h1>
          <p className="text-gray-600 mb-6">
            The article you are looking for does not exist or has been unpublished.
          </p>
          <Link
            href="/kb"
            className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Back to Knowledge Base
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link
          href="/kb"
          className="mb-6 inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
        >
          <svg
            className="h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M17 10a.75.75 0 01-.75.75H5.612l4.158 4.158a.75.75 0 11-1.06 1.06l-5.5-5.5a.75.75 0 010-1.06l5.5-5.5a.75.75 0 011.06 1.06L5.612 9.25H16.25A.75.75 0 0117 10z"
              clipRule="evenodd"
            />
          </svg>
          Back to Knowledge Base
        </Link>

        {/* Article header */}
        <div className="rounded-lg bg-white p-8 shadow-sm border border-gray-200">
          <h1 className="mb-4 text-2xl font-bold text-gray-900">{article.title}</h1>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span
              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                CATEGORY_COLORS[article.category]
              }`}
            >
              {CATEGORY_LABELS[article.category]}
            </span>
            <span className="text-xs text-gray-400">
              {article.viewCount} view{article.viewCount !== 1 ? 's' : ''}
            </span>
          </div>

          <hr className="mb-6 border-gray-200" />

          {/* Article content rendered with react-markdown */}
          <div className="prose prose-gray max-w-none">
            <ReactMarkdown
              components={{
                h1: ({ children }) => (
                  <h1 className="mb-4 mt-6 text-xl font-bold text-gray-900 first:mt-0">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="mb-3 mt-6 text-lg font-semibold text-gray-900">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="mb-2 mt-4 text-base font-semibold text-gray-800">
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p className="mb-4 text-sm leading-relaxed text-gray-700">
                    {children}
                  </p>
                ),
                ul: ({ children }) => (
                  <ul className="mb-4 list-disc space-y-1 pl-6 text-sm text-gray-700">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="mb-4 list-decimal space-y-1 pl-6 text-sm text-gray-700">
                    {children}
                  </ol>
                ),
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                code: ({ children, className }) => {
                  const isBlock = className?.includes('language-');
                  if (isBlock) {
                    return (
                      <code className="block rounded-md bg-gray-100 p-4 font-mono text-sm text-gray-800 whitespace-pre-wrap">
                        {children}
                      </code>
                    );
                  }
                  return (
                    <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-sm text-gray-800">
                      {children}
                    </code>
                  );
                },
                pre: ({ children }) => (
                  <pre className="mb-4 overflow-x-auto rounded-md bg-gray-100">
                    {children}
                  </pre>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="mb-4 border-l-4 border-blue-300 pl-4 italic text-gray-600">
                    {children}
                  </blockquote>
                ),
                table: ({ children }) => (
                  <div className="mb-4 overflow-x-auto">
                    <table className="min-w-full border-collapse border border-gray-200 text-sm">
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead className="bg-gray-50">{children}</thead>
                ),
                th: ({ children }) => (
                  <th className="border border-gray-200 px-4 py-2 text-left font-semibold text-gray-700">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border border-gray-200 px-4 py-2 text-gray-700">
                    {children}
                  </td>
                ),
                hr: () => <hr className="my-6 border-gray-200" />,
                strong: ({ children }) => (
                  <strong className="font-semibold text-gray-900">{children}</strong>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    className="text-blue-600 hover:underline"
                    target={href?.startsWith('http') ? '_blank' : undefined}
                    rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                  >
                    {children}
                  </a>
                ),
              }}
            >
              {article.content}
            </ReactMarkdown>
          </div>
        </div>

        {/* Related articles */}
        {related.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Related Articles</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((rel) => (
                <Link
                  key={rel.id}
                  href={`/kb/${rel.slug}`}
                  className="rounded-lg bg-white p-4 shadow-sm border border-gray-200 hover:border-blue-300 hover:shadow transition-all"
                >
                  <span
                    className={`mb-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      CATEGORY_COLORS[rel.category]
                    }`}
                  >
                    {CATEGORY_LABELS[rel.category]}
                  </span>
                  <p className="text-sm font-medium text-gray-900">{rel.title}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
