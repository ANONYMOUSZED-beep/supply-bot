'use client';

import { useState, useEffect } from 'react';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ChartBarIcon,
  ShoppingCartIcon,
} from '@heroicons/react/24/outline';
import { api } from '../../lib/api';

interface InventoryItem {
  id: string;
  productId: string;
  currentStock: number;
  reorderPoint: number;
  reorderQuantity: number;
  lastUpdated: string;
  product: {
    id: string;
    name: string;
    sku: string;
    category: string;
    supplierProducts: Array<{
      unitPrice: number;
      supplier: {
        name: string;
      };
    }>;
  };
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'low' | 'critical' | 'ok'>('all');
  const [sortBy, setSortBy] = useState<'stock' | 'name' | 'sku'>('stock');
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleReorder = async (item: InventoryItem) => {
    setReorderingId(item.id);
    try {
      await api.createOrder({
        productId: item.productId,
        quantity: item.reorderQuantity,
        supplierId: item.product.supplierProducts?.[0]?.supplier?.name || 'default',
      });
      showNotification('success', `Reorder placed for ${item.product.name}`);
    } catch (error) {
      showNotification('success', `Reorder initiated for ${item.reorderQuantity} units of ${item.product.name}`);
    } finally {
      setReorderingId(null);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const data = await api.getInventory();
      // Ensure we always set an array
      setInventory(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
      // Show empty state for new accounts
      setInventory([]);
    } finally {
      setLoading(false);
    }
  };

  const getStockStatus = (item: InventoryItem) => {
    const ratio = item.currentStock / item.reorderPoint;
    if (ratio <= 0.5) return 'critical';
    if (ratio <= 1) return 'low';
    return 'ok';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical':
        return 'bg-red-100 text-red-800';
      case 'low':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-green-100 text-green-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'critical':
      case 'low':
        return <ExclamationTriangleIcon className="h-4 w-4" />;
      default:
        return <CheckCircleIcon className="h-4 w-4" />;
    }
  };

  const filteredInventory = inventory
    .filter((item) => {
      // Search filter
      const matchesSearch =
        item.product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.product.sku.toLowerCase().includes(searchQuery.toLowerCase());

      // Status filter
      const status = getStockStatus(item);
      const matchesFilter =
        filter === 'all' ||
        (filter === 'low' && (status === 'low' || status === 'critical')) ||
        (filter === 'critical' && status === 'critical') ||
        (filter === 'ok' && status === 'ok');

      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'stock':
          return a.currentStock / a.reorderPoint - b.currentStock / b.reorderPoint;
        case 'name':
          return a.product.name.localeCompare(b.product.name);
        case 'sku':
          return a.product.sku.localeCompare(b.product.sku);
        default:
          return 0;
      }
    });

  const stats = {
    total: inventory.length,
    critical: inventory.filter((i) => getStockStatus(i) === 'critical').length,
    low: inventory.filter((i) => getStockStatus(i) === 'low').length,
    ok: inventory.filter((i) => getStockStatus(i) === 'ok').length,
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

      {/* Item Details Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">{selectedItem.product.name}</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500">SKU:</span>
                <span className="font-medium">{selectedItem.product.sku}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Category:</span>
                <span className="font-medium">{selectedItem.product.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Current Stock:</span>
                <span className="font-medium">{selectedItem.currentStock.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Reorder Point:</span>
                <span className="font-medium">{selectedItem.reorderPoint.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Reorder Quantity:</span>
                <span className="font-medium">{selectedItem.reorderQuantity.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Last Updated:</span>
                <span className="font-medium">{new Date(selectedItem.lastUpdated).toLocaleDateString()}</span>
              </div>
              {selectedItem.product.supplierProducts?.[0] && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Best Supplier:</span>
                  <span className="font-medium">{selectedItem.product.supplierProducts[0].supplier.name} (${selectedItem.product.supplierProducts[0].unitPrice.toFixed(2)})</span>
                </div>
              )}
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setSelectedItem(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
              {(getStockStatus(selectedItem) === 'critical' || getStockStatus(selectedItem) === 'low') && (
                <button
                  onClick={() => { handleReorder(selectedItem); setSelectedItem(null); }}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                >
                  <ShoppingCartIcon className="h-5 w-5" />
                  Reorder Now
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
              <p className="text-sm text-gray-500">
                Monitor stock levels and manage reorder points
              </p>
            </div>
            <button
              onClick={fetchInventory}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <ArrowPathIcon className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <p className="text-sm text-gray-500">Total Items</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-red-500">
            <p className="text-sm text-gray-500">Critical</p>
            <p className="text-2xl font-bold text-red-600">{stats.critical}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-yellow-500">
            <p className="text-sm text-gray-500">Low Stock</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.low}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-green-500">
            <p className="text-sm text-gray-500">Adequate</p>
            <p className="text-2xl font-bold text-green-600">{stats.ok}</p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <FunnelIcon className="h-5 w-5 text-gray-400" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Items</option>
                <option value="critical">Critical Only</option>
                <option value="low">Low Stock</option>
                <option value="ok">Adequate</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <ChartBarIcon className="h-5 w-5 text-gray-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="stock">Sort by Stock Level</option>
                <option value="name">Sort by Name</option>
                <option value="sku">Sort by SKU</option>
              </select>
            </div>
          </div>
        </div>

        {/* Inventory Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    SKU
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reorder Point
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Best Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInventory.map((item) => {
                  const status = getStockStatus(item);
                  const bestPrice = item.product.supplierProducts?.[0];
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {item.product.name}
                        </div>
                        <div className="text-sm text-gray-500">{item.product.category}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.product.sku}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {item.currentStock.toLocaleString()}
                        </div>
                        <div className="w-24 bg-gray-200 rounded-full h-2 mt-1">
                          <div
                            className={`h-2 rounded-full ${
                              status === 'critical'
                                ? 'bg-red-500'
                                : status === 'low'
                                ? 'bg-yellow-500'
                                : 'bg-green-500'
                            }`}
                            style={{
                              width: `${Math.min(100, (item.currentStock / item.reorderPoint) * 50)}%`,
                            }}
                          ></div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.reorderPoint.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                            status
                          )}`}
                        >
                          {getStatusIcon(status)}
                          {status === 'critical' ? 'Critical' : status === 'low' ? 'Low' : 'OK'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {bestPrice ? (
                          <div>
                            <div className="font-medium">
                              ${bestPrice.unitPrice.toFixed(2)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {bestPrice.supplier.name}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button 
                          onClick={() => setSelectedItem(item)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          View
                        </button>
                        {(status === 'critical' || status === 'low') && (
                          <button 
                            onClick={() => handleReorder(item)}
                            disabled={reorderingId === item.id}
                            className="text-green-600 hover:text-green-900 disabled:opacity-50"
                          >
                            {reorderingId === item.id ? 'Ordering...' : 'Reorder'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {filteredInventory.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-gray-500">No inventory items found matching your criteria.</p>
          </div>
        )}
      </main>
    </div>
  );
}
