'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useToast } from '@/components/ui/Toast';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

const DEFAULT_TEMPLATES: EmailTemplate[] = [
  {
    id: 'default-1',
    name: 'Initial Offer',
    subject: 'Cash Offer for {{address}}',
    body: `Dear {{ownerName}},

I am writing to express interest in purchasing your property at {{address}}. We are prepared to make a cash offer of {{offerAmount}}.

Our team at {{buyerName}} specializes in quick, hassle-free closings. We can close in as little as 14 days with no contingencies.

Please let us know if you would like to discuss this opportunity further.

Best regards,
{{buyerName}}`,
  },
  {
    id: 'default-2',
    name: 'Follow-Up',
    subject: 'Following Up - {{address}}',
    body: `Hi {{ownerName}},

I wanted to follow up on our previous offer for your property at {{address}}. Our offer of {{offerAmount}} still stands.

We understand selling a property is a big decision, and we are here to answer any questions you may have. {{buyerName}} prides itself on transparent, fair dealings.

Feel free to reach out at your convenience.

Best,
{{buyerName}}`,
  },
];

const SAMPLE_DATA: Record<string, string> = {
  ownerName: 'John Smith',
  address: '123 Main St',
  offerAmount: '$150,000',
  buyerName: 'Your Company',
};

function renderTemplate(text: string, data: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? `{{${key}}}`);
}

interface UserSettings {
  sendgridApiKey: string;
  senderEmail: string;
  senderName: string;
  propstreamEmail: string;
  propstreamPassword: string;
  reiskipApiKey: string;
  defaultMinEquity: number;
  autoCreateDeals: boolean;
  emailNotifications: boolean;
  dailyDigest: boolean;
}


function maskKey(key: string): string {
  if (!key || key.length < 8) return key ? '****' : '';
  return key.slice(0, 4) + '****' + key.slice(-4);
}

export default function SettingsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [settings, setSettings] = useState<UserSettings>({
    sendgridApiKey: '',
    senderEmail: '',
    senderName: '',
    propstreamEmail: '',
    propstreamPassword: '',
    reiskipApiKey: '',
    defaultMinEquity: 30,
    autoCreateDeals: true,
    emailNotifications: true,
    dailyDigest: false,
  });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<'integrations' | 'preferences' | 'account' | 'email-templates'>('integrations');

  // Email Templates
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [isNewTemplate, setIsNewTemplate] = useState(false);
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.settings) {
          setSettings((prev) => ({ ...prev, ...data.settings }));
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));

    // Load email templates from localStorage
    try {
      const stored = localStorage.getItem('emailTemplates');
      if (stored) {
        const parsed = JSON.parse(stored) as EmailTemplate[];
        setEmailTemplates(parsed);
      } else {
        // First load: seed with defaults
        setEmailTemplates(DEFAULT_TEMPLATES);
        localStorage.setItem('emailTemplates', JSON.stringify(DEFAULT_TEMPLATES));
      }
    } catch {
      setEmailTemplates(DEFAULT_TEMPLATES);
      localStorage.setItem('emailTemplates', JSON.stringify(DEFAULT_TEMPLATES));
    }
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Save failed' }));
        toast(err.error ?? 'Failed to save settings', 'error');
        return;
      }
      toast('Settings saved successfully', 'success');
    } catch {
      toast('Network error — could not save settings', 'error');
    } finally {
      setSaving(false);
    }
  }

  function updateSetting<K extends keyof UserSettings>(key: K, value: UserSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  // ── Email Template CRUD ─────────────────────────────────────────────────────

  function saveTemplatesToStorage(templates: EmailTemplate[]) {
    setEmailTemplates(templates);
    localStorage.setItem('emailTemplates', JSON.stringify(templates));
  }

  function handleNewTemplate() {
    setEditingTemplate({ id: '', name: '', subject: '', body: '' });
    setIsNewTemplate(true);
  }

  function handleEditTemplate(template: EmailTemplate) {
    setEditingTemplate({ ...template });
    setIsNewTemplate(false);
  }

  function handleSaveTemplate() {
    if (!editingTemplate || !editingTemplate.name.trim() || !editingTemplate.subject.trim()) {
      toast('Template name and subject are required', 'error');
      return;
    }
    let updated: EmailTemplate[];
    if (isNewTemplate) {
      const newTemplate = { ...editingTemplate, id: crypto.randomUUID() };
      updated = [...emailTemplates, newTemplate];
    } else {
      updated = emailTemplates.map((t) => (t.id === editingTemplate.id ? editingTemplate : t));
    }
    saveTemplatesToStorage(updated);
    setEditingTemplate(null);
    setIsNewTemplate(false);
    toast(isNewTemplate ? 'Template created' : 'Template updated', 'success');
  }

  function handleDeleteTemplate(templateId: string) {
    const updated = emailTemplates.filter((t) => t.id !== templateId);
    saveTemplatesToStorage(updated);
    setDeleteConfirmId(null);
    if (previewTemplateId === templateId) setPreviewTemplateId(null);
    toast('Template deleted', 'success');
  }

  const tabs = [
    { key: 'integrations' as const, label: 'Integrations' },
    { key: 'preferences' as const, label: 'Preferences' },
    { key: 'email-templates' as const, label: 'Email Templates' },
    { key: 'account' as const, label: 'Account' },
  ];

  if (!loaded) {
    return (
      <div className="p-8">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4 animate-pulse" />
          <div className="h-64 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Settings</h1>

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-100 p-0.5 mb-8 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Integrations Tab */}
        {activeTab === 'integrations' && (
          <div className="space-y-6">
            {/* SendGrid */}
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">SendGrid Email</h2>
              <p className="text-sm text-gray-500 mb-4">Configure your SendGrid API key for sending offers and follow-up emails.</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                  <input
                    type="password"
                    value={settings.sendgridApiKey}
                    onChange={(e) => updateSetting('sendgridApiKey', e.target.value)}
                    placeholder="SG.xxxx..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                  {settings.sendgridApiKey && (
                    <p className="mt-1 text-xs text-gray-400">Current: {maskKey(settings.sendgridApiKey)}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sender Email</label>
                    <input
                      type="email"
                      value={settings.senderEmail}
                      onChange={(e) => updateSetting('senderEmail', e.target.value)}
                      placeholder="offers@yourdomain.com"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sender Name</label>
                    <input
                      type="text"
                      value={settings.senderName}
                      onChange={(e) => updateSetting('senderName', e.target.value)}
                      placeholder="Your Company Name"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* PropStream */}
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">PropStream</h2>
              <p className="text-sm text-gray-500 mb-4">Credentials for automated property data scraping.</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={settings.propstreamEmail}
                    onChange={(e) => updateSetting('propstreamEmail', e.target.value)}
                    placeholder="your@email.com"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="password"
                    value={settings.propstreamPassword}
                    onChange={(e) => updateSetting('propstreamPassword', e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* REISkip */}
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">REISkip (Skip Tracing)</h2>
              <p className="text-sm text-gray-500 mb-4">API key for contact enrichment via skip-trace lookups.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                <input
                  type="password"
                  value={settings.reiskipApiKey}
                  onChange={(e) => updateSetting('reiskipApiKey', e.target.value)}
                  placeholder="reiskip_xxxx..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                {settings.reiskipApiKey && (
                  <p className="mt-1 text-xs text-gray-400">Current: {maskKey(settings.reiskipApiKey)}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Preferences Tab */}
        {activeTab === 'preferences' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Import Defaults</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Default Min Equity %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={settings.defaultMinEquity}
                    onChange={(e) => updateSetting('defaultMinEquity', parseInt(e.target.value) || 0)}
                    className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-400">Used as default filter when scraping from PropStream</p>
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.autoCreateDeals}
                    onChange={(e) => updateSetting('autoCreateDeals', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">Auto-create deals on import</span>
                    <p className="text-xs text-gray-400">Automatically add imported properties to pipeline as SOURCED</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Notifications</h2>
              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.emailNotifications}
                    onChange={(e) => updateSetting('emailNotifications', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">Email notifications</span>
                    <p className="text-xs text-gray-400">Get notified about offer opens, bounces, and deliverability alerts</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.dailyDigest}
                    onChange={(e) => updateSetting('dailyDigest', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">Daily digest</span>
                    <p className="text-xs text-gray-400">Receive a daily summary of pipeline activity and offer performance</p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Email Templates Tab */}
        {activeTab === 'email-templates' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Email Templates</h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Create and manage reusable templates. Use placeholders: {'{{ownerName}}'}, {'{{address}}'}, {'{{offerAmount}}'}, {'{{buyerName}}'}
                  </p>
                </div>
                {!editingTemplate && (
                  <button
                    onClick={handleNewTemplate}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                  >
                    New Template
                  </button>
                )}
              </div>

              {/* Template Form (inline) */}
              {editingTemplate && (
                <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-4">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {isNewTemplate ? 'New Template' : 'Edit Template'}
                  </h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
                    <input
                      type="text"
                      value={editingTemplate.name}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                      placeholder="e.g. Initial Offer"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subject Line</label>
                    <input
                      type="text"
                      value={editingTemplate.subject}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                      placeholder="e.g. Cash Offer for {{address}}"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
                    <textarea
                      value={editingTemplate.body}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, body: e.target.value })}
                      rows={8}
                      placeholder="Write your email body here. Use {{ownerName}}, {{address}}, {{offerAmount}}, {{buyerName}} as placeholders."
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleSaveTemplate}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                    >
                      {isNewTemplate ? 'Create' : 'Save Changes'}
                    </button>
                    <button
                      onClick={() => { setEditingTemplate(null); setIsNewTemplate(false); }}
                      className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Template List */}
              {emailTemplates.length === 0 && !editingTemplate ? (
                <p className="text-sm text-gray-400 italic py-4">No templates yet. Click &quot;New Template&quot; to create one.</p>
              ) : (
                <div className="space-y-3">
                  {emailTemplates.map((template) => (
                    <div key={template.id} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{template.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">Subject: {template.subject}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setPreviewTemplateId(previewTemplateId === template.id ? null : template.id)}
                            className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                              previewTemplateId === template.id
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {previewTemplateId === template.id ? 'Hide Preview' : 'Preview'}
                          </button>
                          <button
                            onClick={() => handleEditTemplate(template)}
                            disabled={editingTemplate !== null}
                            className="rounded px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
                          >
                            Edit
                          </button>
                          {deleteConfirmId === template.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDeleteTemplate(template.id)}
                                className="rounded px-2 py-1.5 text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="rounded px-2 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(template.id)}
                              className="rounded px-3 py-1.5 text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Preview */}
                      {previewTemplateId === template.id && (
                        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-2">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Preview with sample data</p>
                          <div className="rounded border border-gray-200 bg-white p-3">
                            <p className="text-xs text-gray-500 mb-1">
                              <span className="font-medium">Subject:</span> {renderTemplate(template.subject, SAMPLE_DATA)}
                            </p>
                            <div className="border-t border-gray-100 pt-2 mt-2">
                              <p className="text-sm text-gray-800 whitespace-pre-wrap">
                                {renderTemplate(template.body, SAMPLE_DATA)}
                              </p>
                            </div>
                          </div>
                          <p className="text-[10px] text-gray-400">
                            Sample: ownerName=&quot;John Smith&quot;, address=&quot;123 Main St&quot;, offerAmount=&quot;$150,000&quot;, buyerName=&quot;Your Company&quot;
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Account Tab */}
        {activeTab === 'account' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Info</h2>
              <dl className="space-y-3">
                <div className="flex items-center justify-between">
                  <dt className="text-sm text-gray-500">Name</dt>
                  <dd className="text-sm font-medium text-gray-900">{user?.fullName ?? '—'}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-sm text-gray-500">Email</dt>
                  <dd className="text-sm font-medium text-gray-900">{user?.primaryEmailAddress?.emailAddress ?? '—'}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-sm text-gray-500">Member since</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Data & Privacy</h2>
              <p className="text-sm text-gray-500 mb-4">
                All sensitive data (phone numbers, API keys) is encrypted at rest. Contact logs include full TCPA audit trails.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    fetch('/api/settings/export')
                      .then((r) => r.blob())
                      .then((blob) => {
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `deal-platform-export-${new Date().toISOString().slice(0, 10)}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                        toast('Data exported', 'success');
                      })
                      .catch(() => toast('Export failed', 'error'));
                  }}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-colors"
                >
                  Export My Data
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Save button */}
        {activeTab !== 'account' && activeTab !== 'email-templates' && (
          <div className="mt-8 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
