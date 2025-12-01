'use client';

import { useState, useEffect } from 'react';
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ChatBubbleLeftRightIcon,
  EnvelopeIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import { api } from '../../lib/api';

interface NegotiationMessage {
  id: string;
  content: string;
  direction: 'outbound' | 'inbound';
  sentAt: string;
}

interface Negotiation {
  id: string;
  status: string;
  targetDiscount: number;
  achievedDiscount: number | null;
  startedAt: string;
  lastActivity: string;
  supplier: {
    id: string;
    name: string;
    contactEmail: string;
  };
  messages: NegotiationMessage[];
}

export default function NegotiationsPage() {
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNegotiation, setSelectedNegotiation] = useState<Negotiation | null>(null);
  const [filter, setFilter] = useState<'all' | 'in_progress' | 'successful' | 'failed'>('all');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showNewNegotiationModal, setShowNewNegotiationModal] = useState(false);
  const [sendingFollowup, setSendingFollowup] = useState(false);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSendFollowup = async () => {
    setSendingFollowup(true);
    setTimeout(() => {
      if (selectedNegotiation) {
        const newMessage: NegotiationMessage = {
          id: Date.now().toString(),
          content: 'Following up on our previous discussion. Looking forward to your response.',
          direction: 'outbound',
          sentAt: new Date().toISOString(),
        };
        setSelectedNegotiation({
          ...selectedNegotiation,
          messages: [...selectedNegotiation.messages, newMessage],
        });
        showNotification('success', 'Follow-up message sent');
      }
      setSendingFollowup(false);
    }, 1000);
  };

  const handleViewThread = () => {
    if (selectedNegotiation) {
      showNotification('success', `Opening email thread with ${selectedNegotiation.supplier.name}`);
    }
  };

  useEffect(() => {
    fetchNegotiations();
  }, []);

  const fetchNegotiations = async () => {
    setLoading(true);
    try {
      const data = await api.getNegotiations();
      setNegotiations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch negotiations:', error);
      setNegotiations([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'successful':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      initiated: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      successful: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      pending_response: 'bg-purple-100 text-purple-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const filteredNegotiations = negotiations.filter((neg) => {
    if (filter === 'all') return true;
    return neg.status === filter;
  });

  const stats = {
    total: negotiations.length,
    inProgress: negotiations.filter((n) => ['initiated', 'in_progress', 'pending_response'].includes(n.status)).length,
    successful: negotiations.filter((n) => n.status === 'successful').length,
    failed: negotiations.filter((n) => n.status === 'failed').length,
    avgDiscount:
      negotiations
        .filter((n) => n.achievedDiscount)
        .reduce((sum, n) => sum + (n.achievedDiscount || 0), 0) /
        (negotiations.filter((n) => n.achievedDiscount).length || 1),
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${
          notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white font-medium`}>
          {notification.message}
        </div>
      )}

      {/* New Negotiation Modal */}
      {showNewNegotiationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Start New Negotiation</h3>
            <form onSubmit={(e) => { e.preventDefault(); showNotification('success', 'Negotiation initiated - AI agent will begin outreach'); setShowNewNegotiationModal(false); }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option>Northern Lumber Co.</option>
                    <option>Hardware Supply Direct</option>
                    <option>Premium Finishes Inc.</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Discount (%)</label>
                  <input type="number" className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="10" min="1" max="50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Products</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option>All Products</option>
                    <option>Oak Lumber</option>
                    <option>Hardware Items</option>
                  </select>
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button type="button" onClick={() => setShowNewNegotiationModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Start Negotiation</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main List */}
      <div className={`flex-1 ${selectedNegotiation ? 'max-w-2xl' : ''}`}>
        {/* Header */}
        <header className="bg-white shadow-sm">
          <div className="px-4 py-4 sm:px-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Negotiations</h1>
                <p className="text-sm text-gray-500">AI-powered supplier negotiations</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={fetchNegotiations}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <ArrowPathIcon className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <button
                  onClick={() => setShowNewNegotiationModal(true)}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <ChatBubbleLeftRightIcon className="h-5 w-5 mr-2" />
                  New Negotiation
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-yellow-500">
              <p className="text-sm text-gray-500">In Progress</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.inProgress}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-green-500">
              <p className="text-sm text-gray-500">Successful</p>
              <p className="text-2xl font-bold text-green-600">{stats.successful}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-blue-500">
              <p className="text-sm text-gray-500">Avg. Discount</p>
              <p className="text-2xl font-bold text-blue-600">{stats.avgDiscount.toFixed(1)}%</p>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
            <div className="flex gap-2">
              {(['all', 'in_progress', 'successful', 'failed'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    filter === f
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {f === 'all'
                    ? 'All'
                    : f === 'in_progress'
                    ? 'In Progress'
                    : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Negotiation List */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredNegotiations.map((negotiation) => (
                <div
                  key={negotiation.id}
                  onClick={() => setSelectedNegotiation(negotiation)}
                  className={`bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow ${
                    selectedNegotiation?.id === negotiation.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3">
                      {getStatusIcon(negotiation.status)}
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {negotiation.supplier.name}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {negotiation.supplier.contactEmail}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadge(
                        negotiation.status
                      )}`}
                    >
                      {negotiation.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="mt-4 flex justify-between text-sm">
                    <div>
                      <span className="text-gray-500">Target: </span>
                      <span className="font-medium">{negotiation.targetDiscount}%</span>
                    </div>
                    {negotiation.achievedDiscount && (
                      <div>
                        <span className="text-gray-500">Achieved: </span>
                        <span className="font-medium text-green-600">
                          {negotiation.achievedDiscount}%
                        </span>
                      </div>
                    )}
                    <div className="text-gray-400">
                      {new Date(negotiation.startedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {filteredNegotiations.length === 0 && !loading && (
            <div className="text-center py-12">
              <ChatBubbleLeftRightIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No negotiations found.</p>
            </div>
          )}
        </main>
      </div>

      {/* Detail Panel */}
      {selectedNegotiation && (
        <div className="w-[480px] border-l border-gray-200 bg-white flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {selectedNegotiation.supplier.name}
                </h2>
                <p className="text-sm text-gray-500">
                  Started {new Date(selectedNegotiation.startedAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedNegotiation(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-500">Target</p>
                <p className="text-lg font-semibold">{selectedNegotiation.targetDiscount}%</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-500">Achieved</p>
                <p className="text-lg font-semibold text-green-600">
                  {selectedNegotiation.achievedDiscount
                    ? `${selectedNegotiation.achievedDiscount}%`
                    : '-'}
                </p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {selectedNegotiation.messages?.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.direction === 'outbound'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <p
                    className={`text-xs mt-1 ${
                      message.direction === 'outbound' ? 'text-blue-200' : 'text-gray-400'
                    }`}
                  >
                    {new Date(message.sentAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex gap-2">
              <button onClick={handleViewThread} className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
                <EnvelopeIcon className="h-4 w-4 mr-2" />
                View Thread
              </button>
              <button onClick={handleSendFollowup} disabled={sendingFollowup} className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                <PaperAirplaneIcon className={`h-4 w-4 mr-2 ${sendingFollowup ? 'animate-pulse' : ''}`} />
                {sendingFollowup ? 'Sending...' : 'Send Follow-up'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
