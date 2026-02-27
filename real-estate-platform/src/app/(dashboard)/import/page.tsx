'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';

interface ImportResult {
  totalRows: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
}

type ImportStatus = 'idle' | 'uploading' | 'importing' | 'done' | 'error';

export default function ImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  // ── File selection ────────────────────────────────────────────────────────────

  function handleFileSelect(file: File | null) {
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      alert('Please select a CSV file (.csv)');
      return;
    }
    setSelectedFile(file);
    setResult(null);
    setErrorMessage(null);
    setStatus('idle');
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    handleFileSelect(file);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    handleFileSelect(file);
  }

  // ── Import ────────────────────────────────────────────────────────────────────

  async function handleImport() {
    if (!selectedFile) return;

    setStatus('uploading');
    setResult(null);
    setErrorMessage(null);
    setShowErrorDetails(false);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      setStatus('importing');
      const res = await fetch('/api/properties/import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error ?? 'Import failed. Please check your CSV file and try again.');
        setStatus('error');
        return;
      }

      setResult(data as ImportResult);
      setStatus('done');
    } catch {
      setErrorMessage('Network error — could not reach the server. Please try again.');
      setStatus('error');
    }
  }

  function handleReset() {
    setSelectedFile(null);
    setResult(null);
    setErrorMessage(null);
    setStatus('idle');
    setShowErrorDetails(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const isProcessing = status === 'uploading' || status === 'importing';

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Back link */}
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            &larr; Back to Dashboard
          </Link>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Import Properties</h1>
          <p className="mt-2 text-gray-500">
            Export your property list from PropStream as CSV, then upload below to import into your pipeline.
          </p>
        </div>

        {/* Instructions */}
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <p className="font-semibold mb-1">How to export from PropStream:</p>
          <ol className="list-decimal list-inside space-y-1 text-blue-700">
            <li>Search for properties with your target criteria in PropStream</li>
            <li>Select all results and click &quot;Export&quot;</li>
            <li>Choose CSV format and download the file</li>
            <li>Upload the CSV file below</li>
          </ol>
        </div>

        {/* Upload area */}
        <div className="mb-6">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !selectedFile && fileInputRef.current?.click()}
            className={`rounded-xl border-2 border-dashed transition-colors cursor-pointer ${
              isDragOver
                ? 'border-blue-400 bg-blue-50'
                : selectedFile
                ? 'border-green-400 bg-green-50 cursor-default'
                : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50'
            } p-8 text-center`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleInputChange}
            />

            {selectedFile ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 text-green-700">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-semibold">File selected</span>
                </div>
                <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
                <button
                  onClick={(e) => { e.stopPropagation(); handleReset(); }}
                  className="mt-2 text-xs text-gray-500 hover:text-red-600 underline"
                >
                  Remove file
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-center">
                  <svg className="h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700">
                    Drag &amp; drop your CSV file here
                  </p>
                  <p className="text-xs text-gray-400 mt-1">or click to browse</p>
                </div>
                <p className="text-xs text-gray-400">Supports PropStream CSV exports up to 10,000 rows</p>
              </div>
            )}
          </div>
        </div>

        {/* Import button */}
        {selectedFile && status !== 'done' && (
          <div className="mb-6">
            <button
              onClick={handleImport}
              disabled={isProcessing}
              className="w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
            >
              {isProcessing ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {status === 'uploading' ? 'Uploading...' : 'Importing properties...'}
                </span>
              ) : (
                'Import Properties'
              )}
            </button>
          </div>
        )}

        {/* Error state */}
        {status === 'error' && errorMessage && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            <p className="font-semibold">Import failed</p>
            <p className="mt-1 text-sm">{errorMessage}</p>
            <button
              onClick={handleReset}
              className="mt-3 text-sm text-red-600 underline hover:text-red-800"
            >
              Try again with a different file
            </button>
          </div>
        )}

        {/* Success: Import results */}
        {status === 'done' && result && (
          <div className="space-y-4">
            <div className="rounded-xl border border-green-200 bg-green-50 p-6">
              <div className="flex items-center gap-2 mb-4">
                <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h2 className="text-base font-semibold text-green-900">Import Complete</h2>
              </div>

              <dl className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <dt className="flex items-center gap-2 text-gray-600">
                    <span className="font-mono text-green-600">✓</span>
                    Properties imported
                  </dt>
                  <dd className="font-bold text-green-800">{result.imported.toLocaleString()}</dd>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <dt className="flex items-center gap-2 text-gray-600">
                    <span className="font-mono text-blue-600">↺</span>
                    Properties updated (already existed)
                  </dt>
                  <dd className="font-bold text-blue-800">{result.updated.toLocaleString()}</dd>
                </div>
                {result.skipped > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <dt className="flex items-center gap-2 text-gray-600">
                      <span className="font-mono text-gray-500">—</span>
                      Rows skipped (missing required fields)
                    </dt>
                    <dd className="font-bold text-gray-700">{result.skipped.toLocaleString()}</dd>
                  </div>
                )}
                {result.errors.length > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <dt className="flex items-center gap-2 text-gray-600">
                      <span className="font-mono text-red-600">✗</span>
                      Errors
                    </dt>
                    <dd className="font-bold text-red-700">{result.errors.length}</dd>
                  </div>
                )}
                <div className="border-t border-green-200 pt-2 flex items-center justify-between text-sm">
                  <dt className="text-gray-600">Total rows processed</dt>
                  <dd className="font-semibold text-gray-900">{result.totalRows.toLocaleString()}</dd>
                </div>
              </dl>
            </div>

            {/* Error details (expandable) */}
            {result.errors.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <button
                  onClick={() => setShowErrorDetails((v) => !v)}
                  className="flex items-center justify-between w-full text-sm font-semibold text-red-800"
                >
                  <span>Error Details ({result.errors.length})</span>
                  <svg
                    className={`h-4 w-4 transition-transform ${showErrorDetails ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showErrorDetails && (
                  <ul className="mt-3 space-y-1 text-xs text-red-700 max-h-40 overflow-y-auto">
                    {result.errors.map((err, i) => (
                      <li key={i} className="font-mono">{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Next steps */}
            <div className="flex flex-wrap gap-3">
              <Link
                href="/properties"
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
              >
                Browse Imported Properties
              </Link>
              <Link
                href="/pipeline"
                className="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
              >
                View Pipeline
              </Link>
              <button
                onClick={handleReset}
                className="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
              >
                Import Another File
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
