'use client';

import { useState } from 'react';
import {
  CogIcon,
  BellIcon,
  KeyIcon,
  UserCircleIcon,
  BuildingOfficeIcon,
  CpuChipIcon,
  EnvelopeIcon,
  ShieldCheckIcon,
  CloudArrowUpIcon,
} from '@heroicons/react/24/outline';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState({
    companyName: 'Artisan Furniture Co.',
    email: 'procurement@artisanfurniture.com',
    timezone: 'America/Chicago',
    currency: 'USD',
    autoReorder: true,
    reorderThreshold: 20,
    notifyLowStock: true,
    notifyPriceChanges: true,
    notifyNegotiations: true,
    emailDigest: 'daily',
    scoutInterval: 6,
    diplomatAggression: 'balanced',
    maxAutoApprove: 500,
    requireApprovalAbove: 1000,
    apiKey: 'sk-••••••••••••••••',
    webhookUrl: '',
  });

  const tabs = [
    { id: 'general', name: 'General', icon: CogIcon },
    { id: 'company', name: 'Company', icon: BuildingOfficeIcon },
    { id: 'notifications', name: 'Notifications', icon: BellIcon },
    { id: 'agents', name: 'AI Agents', icon: CpuChipIcon },
    { id: 'security', name: 'Security', icon: ShieldCheckIcon },
    { id: 'integrations', name: 'Integrations', icon: CloudArrowUpIcon },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500">Manage your Supply-Bot configuration</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-48 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 bg-white rounded-lg shadow-sm p-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">General Settings</h2>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                  <select
                    value={settings.timezone}
                    onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="America/New_York">Eastern Time</option>
                    <option value="America/Chicago">Central Time</option>
                    <option value="America/Denver">Mountain Time</option>
                    <option value="America/Los_Angeles">Pacific Time</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                  <select
                    value={settings.currency}
                    onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="CAD">CAD ($)</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-sm font-medium text-gray-900 mb-4">Auto-Reorder Settings</h3>
                <div className="space-y-4">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={settings.autoReorder}
                      onChange={(e) => setSettings({ ...settings, autoReorder: e.target.checked })}
                      className="h-4 w-4 text-blue-600 rounded"
                    />
                    <span className="text-sm text-gray-700">Enable automatic reordering</span>
                  </label>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reorder when stock falls below (%)
                    </label>
                    <input
                      type="number"
                      value={settings.reorderThreshold}
                      onChange={(e) => setSettings({ ...settings, reorderThreshold: parseInt(e.target.value) })}
                      className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'company' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Company Information</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                  <input
                    type="text"
                    value={settings.companyName}
                    onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Procurement Email</label>
                  <input
                    type="email"
                    value={settings.email}
                    onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Notification Preferences</h2>
              
              <div className="space-y-4">
                <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Low Stock Alerts</p>
                    <p className="text-xs text-gray-500">Get notified when inventory is running low</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifyLowStock}
                    onChange={(e) => setSettings({ ...settings, notifyLowStock: e.target.checked })}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                </label>
                
                <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Price Changes</p>
                    <p className="text-xs text-gray-500">Alert when supplier prices change significantly</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifyPriceChanges}
                    onChange={(e) => setSettings({ ...settings, notifyPriceChanges: e.target.checked })}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                </label>
                
                <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Negotiation Updates</p>
                    <p className="text-xs text-gray-500">Updates on active negotiations</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifyNegotiations}
                    onChange={(e) => setSettings({ ...settings, notifyNegotiations: e.target.checked })}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                </label>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Digest</label>
                  <select
                    value={settings.emailDigest}
                    onChange={(e) => setSettings({ ...settings, emailDigest: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="realtime">Real-time</option>
                    <option value="daily">Daily Summary</option>
                    <option value="weekly">Weekly Summary</option>
                    <option value="none">None</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'agents' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">AI Agent Configuration</h2>
              
              <div className="space-y-4">
                <div className="p-4 border border-gray-200 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-3">🔍 Scout Agent</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Scan Interval (hours)
                    </label>
                    <input
                      type="number"
                      value={settings.scoutInterval}
                      onChange={(e) => setSettings({ ...settings, scoutInterval: parseInt(e.target.value) })}
                      className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">How often to check supplier websites</p>
                  </div>
                </div>

                <div className="p-4 border border-gray-200 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-3">🤝 Diplomat Agent</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Negotiation Style
                    </label>
                    <select
                      value={settings.diplomatAggression}
                      onChange={(e) => setSettings({ ...settings, diplomatAggression: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="conservative">Conservative - Preserve relationships</option>
                      <option value="balanced">Balanced - Fair negotiations</option>
                      <option value="aggressive">Aggressive - Maximum savings</option>
                    </select>
                  </div>
                </div>

                <div className="p-4 border border-gray-200 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-3">🧠 Strategist Agent</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Auto-approve up to ($)
                      </label>
                      <input
                        type="number"
                        value={settings.maxAutoApprove}
                        onChange={(e) => setSettings({ ...settings, maxAutoApprove: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Require approval above ($)
                      </label>
                      <input
                        type="number"
                        value={settings.requireApprovalAbove}
                        onChange={(e) => setSettings({ ...settings, requireApprovalAbove: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Security Settings</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={settings.apiKey}
                      readOnly
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50"
                    />
                    <button className="px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">
                      Regenerate
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h3 className="font-medium text-yellow-800 mb-2">Two-Factor Authentication</h3>
                  <p className="text-sm text-yellow-700 mb-3">Add an extra layer of security to your account</p>
                  <button className="px-4 py-2 bg-yellow-600 text-white text-sm rounded-lg hover:bg-yellow-700">
                    Enable 2FA
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'integrations' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Integrations</h2>
              
              <div className="space-y-4">
                <div className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <span className="text-lg">📊</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">QuickBooks</p>
                        <p className="text-xs text-gray-500">Sync orders and invoices</p>
                      </div>
                    </div>
                    <button className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">
                      Connect
                    </button>
                  </div>
                </div>

                <div className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <span className="text-lg">💬</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Slack</p>
                        <p className="text-xs text-gray-500">Get notifications in Slack</p>
                      </div>
                    </div>
                    <button className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">
                      Connect
                    </button>
                  </div>
                </div>

                <div className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <span className="text-lg">🔗</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Webhook</p>
                        <p className="text-xs text-gray-500">Send events to your server</p>
                      </div>
                    </div>
                    <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">Not configured</span>
                  </div>
                  <input
                    type="url"
                    placeholder="https://your-server.com/webhook"
                    value={settings.webhookUrl}
                    onChange={(e) => setSettings({ ...settings, webhookUrl: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mt-2"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="mt-6 pt-6 border-t border-gray-200 flex justify-end gap-3">
            <button className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">
              Cancel
            </button>
            <button className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
