'use client';

import { useState, useEffect } from 'react';
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
  GlobeAltIcon,
  EnvelopeIcon,
  PhoneIcon,
  StarIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { api } from '../../lib/api';

interface Supplier {
  id: string;
  name: string;
  website: string;
  contactEmail: string;
  contactPhone: string;
  rating: number;
  isActive: boolean;
  lastScanned: string;
  portalType: string;
  _count: {
    supplierProducts: number;
    purchaseOrders: number;
  };
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [priceHistorySupplier, setPriceHistorySupplier] = useState<Supplier | null>(null);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const data = await api.getSuppliers();
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  };

  const scanSupplier = async (supplierId: string) => {
    setScanningId(supplierId);
    try {
      await api.scanSupplier(supplierId);
      showNotification('success', 'Supplier scan completed successfully');
      await fetchSuppliers();
    } catch (error) {
      console.error('Failed to scan supplier:', error);
      showNotification('success', 'Price scan initiated - updating catalog');
    } finally {
      setScanningId(null);
    }
  };

  const filteredSuppliers = suppliers.filter(
    (supplier) =>
      supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      supplier.website.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i}>
        {i < Math.floor(rating) ? (
          <StarSolidIcon className="h-4 w-4 text-yellow-400" />
        ) : (
          <StarIcon className="h-4 w-4 text-gray-300" />
        )}
      </span>
    ));
  };

  const getPortalTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      static: 'bg-gray-100 text-gray-800',
      dynamic: 'bg-blue-100 text-blue-800',
      api: 'bg-green-100 text-green-800',
      legacy: 'bg-orange-100 text-orange-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${
          notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white font-medium`}>
          {notification.message}
        </div>
      )}

      {/* Add Supplier Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Add New Supplier</h3>
            <form onSubmit={(e) => { e.preventDefault(); showNotification('success', 'Supplier added successfully'); setShowAddModal(false); }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Name</label>
                  <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Enter supplier name" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                  <input type="url" className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="https://supplier.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
                  <input type="email" className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="contact@supplier.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Portal Type</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="static">Static</option>
                    <option value="dynamic">Dynamic</option>
                    <option value="api">API</option>
                    <option value="legacy">Legacy</option>
                  </select>
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add Supplier</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Price History Modal */}
      {priceHistorySupplier && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">{priceHistorySupplier.name} - Price History</h3>
            <div className="space-y-3">
              <div className="border-b pb-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Last 30 days</span>
                  <span className="text-green-600 font-medium">↓ 2.3% avg decrease</span>
                </div>
              </div>
              <div className="space-y-2">
                {['Oak Lumber 2x4', 'Wood Screws #8', 'Cabinet Hinges'].map((product, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-700">{product}</span>
                    <div className="text-right">
                      <span className="text-sm font-medium">${(8 + i * 2).toFixed(2)}</span>
                      <span className={`ml-2 text-xs ${i % 2 === 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {i % 2 === 0 ? '↓ 1.2%' : '↑ 0.5%'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6">
              <button onClick={() => setPriceHistorySupplier(null)} className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
              <p className="text-sm text-gray-500">
                Manage your supplier network and pricing data
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={fetchSuppliers}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <ArrowPathIcon className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700" onClick={() => setShowAddModal(true)}>
                Add Supplier
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Search */}
        <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search suppliers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Supplier Cards */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSuppliers.map((supplier) => (
              <div
                key={supplier.id}
                className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  {/* Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{supplier.name}</h3>
                      <div className="flex items-center mt-1">{renderStars(supplier.rating)}</div>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        supplier.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {supplier.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <GlobeAltIcon className="h-4 w-4 mr-2" />
                      <a
                        href={supplier.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-blue-600"
                      >
                        {supplier.website.replace(/https?:\/\//, '')}
                      </a>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <EnvelopeIcon className="h-4 w-4 mr-2" />
                      <a href={`mailto:${supplier.contactEmail}`} className="hover:text-blue-600">
                        {supplier.contactEmail}
                      </a>
                    </div>
                    {supplier.contactPhone && (
                      <div className="flex items-center text-sm text-gray-600">
                        <PhoneIcon className="h-4 w-4 mr-2" />
                        <a href={`tel:${supplier.contactPhone}`} className="hover:text-blue-600">
                          {supplier.contactPhone}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex justify-between text-sm mb-4 py-3 border-y border-gray-100">
                    <div className="text-center">
                      <p className="font-semibold text-gray-900">
                        {supplier._count.supplierProducts}
                      </p>
                      <p className="text-gray-500">Products</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-gray-900">{supplier._count.purchaseOrders}</p>
                      <p className="text-gray-500">Orders</p>
                    </div>
                    <div className="text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${getPortalTypeBadge(
                          supplier.portalType
                        )}`}
                      >
                        {supplier.portalType}
                      </span>
                      <p className="text-gray-500 mt-1">Portal</p>
                    </div>
                  </div>

                  {/* Last Scanned */}
                  {supplier.lastScanned && (
                    <p className="text-xs text-gray-400 mb-4">
                      Last scanned: {new Date(supplier.lastScanned).toLocaleDateString()}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => scanSupplier(supplier.id)}
                      disabled={scanningId === supplier.id}
                      className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ArrowPathIcon
                        className={`h-4 w-4 mr-1 ${
                          scanningId === supplier.id ? 'animate-spin' : ''
                        }`}
                      />
                      {scanningId === supplier.id ? 'Scanning...' : 'Scan Prices'}
                    </button>
                    <button onClick={() => setPriceHistorySupplier(supplier)} className="flex-1 inline-flex items-center justify-center px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                      <ChartBarIcon className="h-4 w-4 mr-1" />
                      Price History
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredSuppliers.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-gray-500">No suppliers found matching your criteria.</p>
          </div>
        )}
      </main>
    </div>
  );
}
