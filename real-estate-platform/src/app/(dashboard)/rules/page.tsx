'use client';

import { useEffect, useState, useCallback } from 'react';

interface Rule {
  id: string;
  name: string;
  description: string | null;
  ruleType: 'FILTER' | 'SCORE_COMPONENT';
  ruleSubtype: string | null;
  fieldName: string;
  operator: string;
  value: unknown;
  weight: number;
  enabled: boolean;
  createdAt: string;
}

type Tab = 'qualification' | 'creative-finance';

const OPERATOR_LABELS: Record<string, string> = {
  GT: '>',
  LT: '<',
  EQ: '=',
  IN: 'in',
  CONTAINS: 'contains',
  RANGE: 'range',
  NOT_CONTAINS: 'not contains',
};

const FIELD_OPTIONS = [
  { value: 'estimatedValue', label: 'Estimated Value (ARV)' },
  { value: 'equityPercent', label: 'Equity %' },
  { value: 'debtOwed', label: 'Debt Owed' },
  { value: 'interestRate', label: 'Interest Rate' },
  { value: 'daysOnMarket', label: 'Days on Market' },
  { value: 'lastSalePrice', label: 'Last Sale Price' },
  { value: 'taxAssessedValue', label: 'Tax Assessed Value' },
  { value: 'distressSignals', label: 'Distress Signals' },
];

const OPERATOR_OPTIONS = ['GT', 'LT', 'EQ', 'IN', 'CONTAINS', 'RANGE', 'NOT_CONTAINS'];

const CF_TYPES = [
  { value: 'SUBJECT_TO', label: 'Subject To' },
  { value: 'SELLER_FINANCE', label: 'Seller Finance' },
  { value: 'OWNER_OCCUPIED_VACATED', label: 'Owner Occupied / Vacated' },
  { value: 'LEASE_OPTION', label: 'Lease Option' },
  { value: 'BRRRR', label: 'BRRRR' },
  { value: 'WHOLESALE', label: 'Wholesale' },
  { value: 'LAND_CONTRACT', label: 'Land Contract' },
  { value: 'RENT_TO_OWN', label: 'Rent to Own' },
];

const CF_TYPE_COLORS: Record<string, string> = {
  SUBJECT_TO: 'bg-purple-100 text-purple-700',
  SELLER_FINANCE: 'bg-indigo-100 text-indigo-700',
  OWNER_OCCUPIED_VACATED: 'bg-teal-100 text-teal-700',
  LEASE_OPTION: 'bg-cyan-100 text-cyan-700',
  BRRRR: 'bg-orange-100 text-orange-700',
  WHOLESALE: 'bg-amber-100 text-amber-700',
  LAND_CONTRACT: 'bg-lime-100 text-lime-700',
  RENT_TO_OWN: 'bg-pink-100 text-pink-700',
};

export default function RulesPage() {
  const [tab, setTab] = useState<Tab>('qualification');

  // Qualification rules state
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Create form state (qualification)
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newRuleType, setNewRuleType] = useState<'FILTER' | 'SCORE_COMPONENT'>('SCORE_COMPONENT');
  const [newFieldName, setNewFieldName] = useState('estimatedValue');
  const [newOperator, setNewOperator] = useState('GT');
  const [newValue, setNewValue] = useState('');
  const [newWeight, setNewWeight] = useState('20');

  // Creative finance rules state
  const [cfRules, setCfRules] = useState<Rule[]>([]);
  const [cfLoading, setCfLoading] = useState(true);
  const [showCfCreate, setShowCfCreate] = useState(false);
  const [cfSaving, setCfSaving] = useState(false);
  const [cfTogglingId, setCfTogglingId] = useState<string | null>(null);
  const [cfDeletingId, setCfDeletingId] = useState<string | null>(null);

  // Create form state (creative finance)
  const [cfName, setCfName] = useState('');
  const [cfDescription, setCfDescription] = useState('');
  const [cfSubtype, setCfSubtype] = useState('SUBJECT_TO');
  const [cfFieldName, setCfFieldName] = useState('equityPercent');
  const [cfOperator, setCfOperator] = useState('GT');
  const [cfValue, setCfValue] = useState('');

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch('/api/rules');
      if (!res.ok) {
        setError('Failed to load rules');
        return;
      }
      const data = await res.json();
      setRules(data.rules ?? []);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCfRules = useCallback(async () => {
    try {
      const res = await fetch('/api/rules/creative-finance');
      if (!res.ok) return;
      const data = await res.json();
      setCfRules(data.rules ?? []);
    } catch {
      // Silent fail for CF rules
    } finally {
      setCfLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
    fetchCfRules();
  }, [fetchRules, fetchCfRules]);

  // Qualification rule handlers
  async function handleCreate() {
    if (!newName.trim() || !newValue.trim()) return;
    setSaving(true);

    let parsedValue: unknown = newValue;
    const asNum = parseFloat(newValue);
    if (!isNaN(asNum)) parsedValue = asNum;

    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || null,
          ruleType: newRuleType,
          fieldName: newFieldName,
          operator: newOperator,
          value: parsedValue,
          weight: newRuleType === 'SCORE_COMPONENT' ? parseInt(newWeight, 10) || 0 : 0,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? 'Failed to create rule');
        return;
      }

      const rule = await res.json();
      setRules((prev) => [...prev, rule]);
      resetForm();
    } catch {
      alert('Network error');
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setShowCreate(false);
    setNewName('');
    setNewDescription('');
    setNewRuleType('SCORE_COMPONENT');
    setNewFieldName('estimatedValue');
    setNewOperator('GT');
    setNewValue('');
    setNewWeight('20');
  }

  async function handleToggle(rule: Rule) {
    setTogglingId(rule.id);
    try {
      const res = await fetch(`/api/rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      if (res.ok) {
        setRules((prev) =>
          prev.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r))
        );
      }
    } catch {
      // Silent fail for toggle
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(ruleId: string) {
    setDeletingId(ruleId);
    try {
      const res = await fetch(`/api/rules/${ruleId}`, { method: 'DELETE' });
      if (res.ok) {
        setRules((prev) => prev.filter((r) => r.id !== ruleId));
      }
    } catch {
      // Silent fail for delete
    } finally {
      setDeletingId(null);
    }
  }

  // Creative finance handlers
  async function handleCfCreate() {
    if (!cfName.trim() || !cfValue.trim()) return;
    setCfSaving(true);

    let parsedValue: unknown = cfValue;
    const asNum = parseFloat(cfValue);
    if (!isNaN(asNum)) parsedValue = asNum;

    try {
      const res = await fetch('/api/rules/creative-finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cfName.trim(),
          description: cfDescription.trim() || null,
          ruleSubtype: cfSubtype,
          fieldName: cfFieldName,
          operator: cfOperator,
          value: parsedValue,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? 'Failed to create rule');
        return;
      }

      const rule = await res.json();
      setCfRules((prev) => [...prev, rule]);
      resetCfForm();
    } catch {
      alert('Network error');
    } finally {
      setCfSaving(false);
    }
  }

  function resetCfForm() {
    setShowCfCreate(false);
    setCfName('');
    setCfDescription('');
    setCfSubtype('SUBJECT_TO');
    setCfFieldName('equityPercent');
    setCfOperator('GT');
    setCfValue('');
  }

  async function handleCfToggle(rule: Rule) {
    setCfTogglingId(rule.id);
    try {
      const res = await fetch('/api/rules/creative-finance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleId: rule.id, enabled: !rule.enabled }),
      });
      if (res.ok) {
        setCfRules((prev) =>
          prev.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r))
        );
      }
    } catch {
      // Silent fail
    } finally {
      setCfTogglingId(null);
    }
  }

  async function handleCfDelete(ruleId: string) {
    setCfDeletingId(ruleId);
    try {
      const res = await fetch('/api/rules/creative-finance', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleId }),
      });
      if (res.ok) {
        setCfRules((prev) => prev.filter((r) => r.id !== ruleId));
      }
    } catch {
      // Silent fail
    } finally {
      setCfDeletingId(null);
    }
  }

  const filterRules = rules.filter((r) => r.ruleType === 'FILTER');
  const scoreRules = rules.filter((r) => r.ruleType === 'SCORE_COMPONENT');

  const isLoading = tab === 'qualification' ? loading : cfLoading;

  if (isLoading && rules.length === 0 && cfRules.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading rules...</div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'qualification', label: 'Qualification Rules', count: rules.length },
    { key: 'creative-finance', label: 'Creative Finance', count: cfRules.length },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Rules</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage qualification and creative finance scoring rules.
            </p>
          </div>
          <button
            onClick={() => tab === 'qualification' ? setShowCreate(true) : setShowCfCreate(true)}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            Add Rule
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t.label}
              <span className={`ml-1.5 text-xs ${tab === t.key ? 'text-blue-200' : 'text-gray-400'}`}>
                ({t.count})
              </span>
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 text-sm">
            {error}
          </div>
        )}

        {/* Qualification Rules Tab */}
        {tab === 'qualification' && (
          <>
            {/* Create form */}
            {showCreate && (
              <div className="mb-8 rounded-xl border border-blue-200 bg-blue-50 p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-4">New Qualification Rule</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. High Equity Properties"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                    <input
                      type="text"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder="What this rule does..."
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                    <select
                      value={newRuleType}
                      onChange={(e) => setNewRuleType(e.target.value as 'FILTER' | 'SCORE_COMPONENT')}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:border-blue-500"
                    >
                      <option value="FILTER">Filter (pass/fail gate)</option>
                      <option value="SCORE_COMPONENT">Score (add points)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Field</label>
                    <select
                      value={newFieldName}
                      onChange={(e) => setNewFieldName(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:border-blue-500"
                    >
                      {FIELD_OPTIONS.map((f) => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Operator</label>
                    <select
                      value={newOperator}
                      onChange={(e) => setNewOperator(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:border-blue-500"
                    >
                      {OPERATOR_OPTIONS.map((op) => (
                        <option key={op} value={op}>{OPERATOR_LABELS[op]} ({op})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Value *</label>
                    <input
                      type="text"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      placeholder="e.g. 50000"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  {newRuleType === 'SCORE_COMPONENT' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Weight (points)</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={newWeight}
                        onChange={(e) => setNewWeight(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  )}
                </div>
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={handleCreate}
                    disabled={saving || !newName.trim() || !newValue.trim()}
                    className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {saving ? 'Creating...' : 'Create Rule'}
                  </button>
                  <button
                    onClick={resetForm}
                    className="rounded-lg border border-gray-200 px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Filter rules */}
            <RuleSection
              title="Filter Rules"
              subtitle="Properties must pass all enabled filter rules to enter the pipeline."
              rules={filterRules}
              togglingId={togglingId}
              deletingId={deletingId}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />

            {/* Score rules */}
            <RuleSection
              title="Score Rules"
              subtitle="Each matching score rule adds points to the deal qualification score."
              rules={scoreRules}
              togglingId={togglingId}
              deletingId={deletingId}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />

            {rules.length === 0 && !loading && (
              <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
                <p className="text-gray-500 font-medium">No qualification rules yet</p>
                <p className="mt-1 text-sm text-gray-400">Add rules to automatically score and filter deals.</p>
              </div>
            )}
          </>
        )}

        {/* Creative Finance Tab */}
        {tab === 'creative-finance' && (
          <>
            {/* Create form */}
            {showCfCreate && (
              <div className="mb-8 rounded-xl border border-purple-200 bg-purple-50 p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-4">New Creative Finance Rule</h2>
                <p className="text-xs text-gray-500 mb-4">
                  Creative finance rules give a +20 point bonus when a property matches. Each rule type helps identify deals suited for specific strategies.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                    <input
                      type="text"
                      value={cfName}
                      onChange={(e) => setCfName(e.target.value)}
                      placeholder="e.g. Low rate subject-to candidate"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                    <input
                      type="text"
                      value={cfDescription}
                      onChange={(e) => setCfDescription(e.target.value)}
                      placeholder="When this rule should trigger..."
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Strategy Type</label>
                    <select
                      value={cfSubtype}
                      onChange={(e) => setCfSubtype(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:border-purple-500"
                    >
                      {CF_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Field</label>
                    <select
                      value={cfFieldName}
                      onChange={(e) => setCfFieldName(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:border-purple-500"
                    >
                      {FIELD_OPTIONS.map((f) => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Operator</label>
                    <select
                      value={cfOperator}
                      onChange={(e) => setCfOperator(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:border-purple-500"
                    >
                      {OPERATOR_OPTIONS.map((op) => (
                        <option key={op} value={op}>{OPERATOR_LABELS[op]} ({op})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Value *</label>
                    <input
                      type="text"
                      value={cfValue}
                      onChange={(e) => setCfValue(e.target.value)}
                      placeholder="e.g. 4.5"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                </div>
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={handleCfCreate}
                    disabled={cfSaving || !cfName.trim() || !cfValue.trim()}
                    className="rounded-lg bg-purple-600 px-5 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
                  >
                    {cfSaving ? 'Creating...' : 'Create Rule'}
                  </button>
                  <button
                    onClick={resetCfForm}
                    className="rounded-lg border border-gray-200 px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Group CF rules by subtype */}
            {cfRules.length === 0 && !cfLoading ? (
              <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
                <p className="text-gray-500 font-medium">No creative finance rules yet</p>
                <p className="mt-1 text-sm text-gray-400">
                  Add rules to identify deals suited for Subject To, Seller Finance, BRRRR, and more.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {cfRules.map((rule) => (
                  <div
                    key={rule.id}
                    className={`rounded-xl border bg-white p-4 shadow-sm transition-opacity ${
                      rule.enabled ? 'border-gray-200' : 'border-gray-100 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="font-semibold text-gray-900 text-sm">{rule.name}</p>
                          {rule.ruleSubtype && (
                            <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${CF_TYPE_COLORS[rule.ruleSubtype] ?? 'bg-gray-100 text-gray-700'}`}>
                              {CF_TYPES.find((t) => t.value === rule.ruleSubtype)?.label ?? rule.ruleSubtype}
                            </span>
                          )}
                          <span className="rounded bg-purple-100 px-1.5 py-0.5 text-xs font-semibold text-purple-700">
                            +20 pts
                          </span>
                        </div>
                        {rule.description && (
                          <p className="text-xs text-gray-500 mb-1">{rule.description}</p>
                        )}
                        <p className="text-xs text-gray-400 font-mono">
                          {rule.fieldName} {OPERATOR_LABELS[rule.operator] ?? rule.operator} {String(rule.value)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleCfToggle(rule)}
                          disabled={cfTogglingId === rule.id}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            rule.enabled ? 'bg-purple-600' : 'bg-gray-300'
                          }`}
                          title={rule.enabled ? 'Disable' : 'Enable'}
                        >
                          <span
                            className={`inline-block h-4 w-4 rounded-full bg-white transition-transform shadow ${
                              rule.enabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                        <button
                          onClick={() => handleCfDelete(rule.id)}
                          disabled={cfDeletingId === rule.id}
                          className="rounded p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete rule"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function RuleSection({
  title,
  subtitle,
  rules,
  togglingId,
  deletingId,
  onToggle,
  onDelete,
}: {
  title: string;
  subtitle: string;
  rules: Rule[];
  togglingId: string | null;
  deletingId: string | null;
  onToggle: (rule: Rule) => void;
  onDelete: (id: string) => void;
}) {
  if (rules.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="text-lg font-bold text-gray-900 mb-1">{title}</h2>
      <p className="text-sm text-gray-500 mb-4">{subtitle}</p>
      <div className="space-y-2">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className={`rounded-xl border bg-white p-4 shadow-sm transition-opacity ${
              rule.enabled ? 'border-gray-200' : 'border-gray-100 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-gray-900 text-sm">{rule.name}</p>
                  {rule.ruleType === 'SCORE_COMPONENT' && (
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-700">
                      +{rule.weight} pts
                    </span>
                  )}
                  {rule.ruleType === 'FILTER' && (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700">
                      Gate
                    </span>
                  )}
                </div>
                {rule.description && (
                  <p className="text-xs text-gray-500 mb-1">{rule.description}</p>
                )}
                <p className="text-xs text-gray-400 font-mono">
                  {rule.fieldName} {OPERATOR_LABELS[rule.operator] ?? rule.operator} {String(rule.value)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onToggle(rule)}
                  disabled={togglingId === rule.id}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    rule.enabled ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                  title={rule.enabled ? 'Disable' : 'Enable'}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white transition-transform shadow ${
                      rule.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <button
                  onClick={() => onDelete(rule.id)}
                  disabled={deletingId === rule.id}
                  className="rounded p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Delete rule"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
