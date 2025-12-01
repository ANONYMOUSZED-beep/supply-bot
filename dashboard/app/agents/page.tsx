'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

interface TestResult {
  agent: string;
  message: string;
  result?: any;
  error?: string;
  response?: string;
  success?: boolean;
  suppliers?: any[];
  supplier?: string;
  product?: string;
}

export default function AgentsPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, TestResult>>({});

  const testAI = async () => {
    setLoading('ai');
    try {
      const result = await api.request<TestResult>('/api/agents/test/ai');
      setResults(prev => ({ ...prev, ai: result }));
    } catch (error: any) {
      setResults(prev => ({ ...prev, ai: { agent: 'AI', message: 'Failed', error: error.message } }));
    }
    setLoading(null);
  };

  const testScout = async () => {
    setLoading('scout');
    try {
      const result = await api.request<TestResult>('/api/agents/test/scout', { method: 'POST' });
      setResults(prev => ({ ...prev, scout: result }));
    } catch (error: any) {
      setResults(prev => ({ ...prev, scout: { agent: 'Scout', message: 'Failed', error: error.message } }));
    }
    setLoading(null);
  };

  const testStrategist = async () => {
    setLoading('strategist');
    try {
      const result = await api.request<TestResult>('/api/agents/test/strategist', { method: 'POST' });
      setResults(prev => ({ ...prev, strategist: result }));
    } catch (error: any) {
      setResults(prev => ({ ...prev, strategist: { agent: 'Strategist', message: 'Failed', error: error.message } }));
    }
    setLoading(null);
  };

  const testDiplomat = async () => {
    setLoading('diplomat');
    try {
      const result = await api.request<TestResult>('/api/agents/test/diplomat', { method: 'POST' });
      setResults(prev => ({ ...prev, diplomat: result }));
    } catch (error: any) {
      setResults(prev => ({ ...prev, diplomat: { agent: 'Diplomat', message: 'Failed', error: error.message } }));
    }
    setLoading(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">AI Agents</h1>
        <p className="text-gray-400 mt-1">Test and monitor your AI procurement agents</p>
      </div>

      {/* Agent Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* AI Test */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">🤖 Gemini AI</h3>
              <p className="text-sm text-gray-400">Test AI connection</p>
            </div>
            <button
              onClick={testAI}
              disabled={loading === 'ai'}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
            >
              {loading === 'ai' ? 'Testing...' : 'Test AI'}
            </button>
          </div>
          {results.ai && (
            <div className="mt-4 p-4 bg-gray-900 rounded-lg">
              <p className={`text-sm ${results.ai.success ? 'text-green-400' : 'text-red-400'}`}>
                {results.ai.success ? '✅ AI Connected' : '❌ AI Failed'}
              </p>
              {results.ai.response && (
                <p className="text-gray-300 mt-2 text-sm italic">"{results.ai.response}"</p>
              )}
              {results.ai.error && (
                <p className="text-red-400 mt-2 text-sm">{results.ai.error}</p>
              )}
            </div>
          )}
        </div>

        {/* Scout Agent */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">🔍 Scout Agent</h3>
              <p className="text-sm text-gray-400">Web scraping & price monitoring</p>
            </div>
            <button
              onClick={testScout}
              disabled={loading === 'scout'}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50"
            >
              {loading === 'scout' ? 'Testing...' : 'Test Scout'}
            </button>
          </div>
          {results.scout && (
            <div className="mt-4 p-4 bg-gray-900 rounded-lg">
              <p className="text-sm text-gray-300">{results.scout.message}</p>
              {results.scout.suppliers && (
                <ul className="mt-2 space-y-1">
                  {results.scout.suppliers.map((s: any) => (
                    <li key={s.id} className="text-sm text-gray-400">
                      • {s.name} {s.hasApi ? '(API)' : s.hasPortal ? '(Portal)' : '(Website)'}
                    </li>
                  ))}
                </ul>
              )}
              {results.scout.error && (
                <p className="text-red-400 mt-2 text-sm">{results.scout.error}</p>
              )}
            </div>
          )}
        </div>

        {/* Strategist Agent */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">📊 Strategist Agent</h3>
              <p className="text-sm text-gray-400">Inventory analysis & predictions</p>
            </div>
            <button
              onClick={testStrategist}
              disabled={loading === 'strategist'}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50"
            >
              {loading === 'strategist' ? 'Analyzing...' : 'Test Strategist'}
            </button>
          </div>
          {results.strategist && (
            <div className="mt-4 p-4 bg-gray-900 rounded-lg">
              <p className="text-sm text-gray-300">{results.strategist.message}</p>
              {results.strategist.result && (
                <div className="mt-2 space-y-2">
                  {results.strategist.result.criticalItems?.length > 0 && (
                    <div>
                      <p className="text-red-400 text-sm font-medium">Critical Items:</p>
                      {results.strategist.result.criticalItems.slice(0, 3).map((item: any, i: number) => (
                        <p key={i} className="text-gray-400 text-sm">• {item.productName}: {item.daysOfStock} days left</p>
                      ))}
                    </div>
                  )}
                  {results.strategist.result.summary && (
                    <p className="text-gray-400 text-sm">{results.strategist.result.summary}</p>
                  )}
                </div>
              )}
              {results.strategist.error && (
                <p className="text-red-400 mt-2 text-sm">{results.strategist.error}</p>
              )}
            </div>
          )}
        </div>

        {/* Diplomat Agent */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">🤝 Diplomat Agent</h3>
              <p className="text-sm text-gray-400">AI-powered negotiations</p>
            </div>
            <button
              onClick={testDiplomat}
              disabled={loading === 'diplomat'}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg disabled:opacity-50"
            >
              {loading === 'diplomat' ? 'Analyzing...' : 'Test Diplomat'}
            </button>
          </div>
          {results.diplomat && (
            <div className="mt-4 p-4 bg-gray-900 rounded-lg">
              <p className="text-sm text-gray-300">{results.diplomat.message}</p>
              {results.diplomat.supplier && (
                <p className="text-gray-400 text-sm mt-1">
                  Supplier: {results.diplomat.supplier} | Product: {results.diplomat.product}
                </p>
              )}
              {results.diplomat.result && (
                <div className="mt-2">
                  <p className="text-gray-400 text-sm">
                    Strategy: {results.diplomat.result.strategy?.approach || 'N/A'}
                  </p>
                  <p className="text-gray-400 text-sm">
                    Target Discount: {results.diplomat.result.strategy?.initialDiscount || 0}%
                  </p>
                </div>
              )}
              {results.diplomat.error && (
                <p className="text-red-400 mt-2 text-sm">{results.diplomat.error}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Info Section */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">How the AI Agents Work</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <h4 className="text-purple-400 font-medium">🔍 Scout Agent</h4>
            <p className="text-gray-400 mt-1">
              Monitors supplier websites and portals for price changes, stock levels, and new products. 
              Uses web scraping and API integration.
            </p>
          </div>
          <div>
            <h4 className="text-green-400 font-medium">📊 Strategist Agent</h4>
            <p className="text-gray-400 mt-1">
              Analyzes inventory data to predict stockouts, optimize reorder points, 
              and identify cost-saving opportunities.
            </p>
          </div>
          <div>
            <h4 className="text-orange-400 font-medium">🤝 Diplomat Agent</h4>
            <p className="text-gray-400 mt-1">
              Uses Gemini AI to craft negotiation emails, analyze supplier responses, 
              and automate price negotiations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
