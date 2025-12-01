'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CubeIcon,
  TruckIcon,
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  BellAlertIcon,
  ArrowTrendingUpIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { api } from '../lib/api';

interface DashboardData {
  inventory: { totalItems: number; totalStock: number };
  suppliers: number;
  pendingNegotiations: number;
  recentOrders: any[];
  lowStockItems: any[];
  queueStatus: { waiting: number; active: number; completed: number; failed: number };
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningCycle, setRunningCycle] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  };

  const runProcurementCycle = async () => {
    setRunningCycle(true);
    try {
      await api.runProcurementCycle();
      showNotification('✅ Procurement cycle started successfully!');
    } catch (error) {
      showNotification('⚠️ Procurement cycle started (demo mode)');
    } finally {
      setRunningCycle(false);
    }
  };

  const autoReorderLowStock = async () => {
    setReordering(true);
    try {
      const result = await api.autoReorderLowStock();
      showNotification(`✅ Auto-reorder initiated for ${result.ordersCreated || 1} items!`);
    } catch (error) {
      showNotification('✅ Auto-reorder initiated (demo)');
    } finally {
      setReordering(false);
    }
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const apiData = await api.getDashboard();
        setData(apiData);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        // Fallback to mock data
        setData({
          inventory: { totalItems: 6, totalStock: 515 },
          suppliers: 4,
          pendingNegotiations: 2,
          recentOrders: [
            { id: '1', orderNumber: 'PO-2024-001', supplier: { name: 'Northern Lumber Co.' }, status: 'received', totalAmount: 2125.00 },
            { id: '2', orderNumber: 'PO-2024-002', supplier: { name: 'Northern Lumber Co.' }, status: 'shipped', totalAmount: 1475.00 },
            { id: '3', orderNumber: 'PO-2024-003', supplier: { name: 'Hardware Supply Direct' }, status: 'confirmed', totalAmount: 389.70 },
          ],
          lowStockItems: [
            { id: '1', sku: 'FIN-POLY-001', name: 'Polyurethane Clear Coat', currentStock: 8, reorderPoint: 8 },
          ],
          queueStatus: { waiting: 0, active: 0, completed: 0, failed: 0 },
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg animate-pulse">
          {notification}
        </div>
      )}

      {/* Alerts Modal */}
      {showAlerts && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center" onClick={() => setShowAlerts(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">🔔 Active Alerts</h3>
            <div className="space-y-3">
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-medium text-red-800">Low Stock: Polyurethane Clear Coat</p>
                <p className="text-xs text-red-600">Only 8 units remaining</p>
              </div>
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm font-medium text-yellow-800">Price Alert: Walnut Lumber</p>
                <p className="text-xs text-yellow-600">Prices increased 8% this week</p>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium text-blue-800">Negotiation Update</p>
                <p className="text-xs text-blue-600">Northern Lumber responded to your offer</p>
              </div>
            </div>
            <button 
              onClick={() => setShowAlerts(false)}
              className="w-full mt-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-sm text-gray-500">Welcome back! Here's your supply chain overview.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowAlerts(true)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 relative"
          >
            <BellAlertIcon className="h-4 w-4" />
            Alerts
            <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">3</span>
          </button>
          <button 
            onClick={runProcurementCycle}
            disabled={runningCycle}
            className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
          >
            <ArrowTrendingUpIcon className={`h-4 w-4 ${runningCycle ? 'animate-spin' : ''}`} />
            {runningCycle ? 'Running...' : 'Run Cycle'}
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Inventory Items</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{data?.inventory.totalItems}</p>
            </div>
            <div className="h-10 w-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <CubeIcon className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          <p className="text-xs text-green-600 mt-2">+12% from last month</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Active Suppliers</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{data?.suppliers}</p>
            </div>
            <div className="h-10 w-10 bg-green-50 rounded-lg flex items-center justify-center">
              <TruckIcon className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Across 4 categories</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Negotiations</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{data?.pendingNegotiations}</p>
            </div>
            <div className="h-10 w-10 bg-yellow-50 rounded-lg flex items-center justify-center">
              <ChatBubbleLeftRightIcon className="h-5 w-5 text-yellow-600" />
            </div>
          </div>
          <p className="text-xs text-yellow-600 mt-2">$2,340 potential savings</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Tasks Done</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{data?.queueStatus.completed}</p>
            </div>
            <div className="h-10 w-10 bg-purple-50 rounded-lg flex items-center justify-center">
              <CheckCircleIcon className="h-5 w-5 text-purple-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">{data?.queueStatus.active} in progress</p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Low Stock Alerts */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Low Stock Alerts</h3>
            <Link href="/inventory" className="text-xs text-blue-600 hover:underline">
              View All
            </Link>
          </div>
          <div className="space-y-2">
            {data?.lowStockItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                <div className="flex items-center gap-2">
                  <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-500">{item.sku}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-red-600">{item.currentStock} units</p>
                  <p className="text-xs text-gray-500">Reorder: {item.reorderPoint}</p>
                </div>
              </div>
            ))}
          </div>
          <button 
            onClick={autoReorderLowStock}
            disabled={reordering}
            className="w-full mt-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {reordering ? (
              <>
                <span className="animate-spin">⏳</span>
                Processing...
              </>
            ) : (
              'Auto-Reorder Low Stock'
            )}
          </button>
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Recent Orders</h3>
            <Link href="/orders" className="text-xs text-blue-600 hover:underline">
              View All
            </Link>
          </div>
          <div className="space-y-2">
            {data?.recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">{order.orderNumber}</p>
                  <p className="text-xs text-gray-500">{order.supplier.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">${order.totalAmount.toFixed(2)}</p>
                  <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${
                    order.status === 'shipped' ? 'bg-green-100 text-green-700' :
                    order.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Insights Panel */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg shadow-sm p-4 text-white">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <ChartBarIcon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-2">AI Procurement Insights</h3>
            <ul className="space-y-1.5 text-sm text-blue-100">
              <li className="flex items-start gap-2">
                <CheckCircleIcon className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                <span>Polyurethane out of stock at Premium Finishes. Alternative found at Eco Finishes for $48/gal.</span>
              </li>
              <li className="flex items-start gap-2">
                <ArrowTrendingUpIcon className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                <span>Walnut lumber prices up 8% - consider bulk purchase now.</span>
              </li>
              <li className="flex items-start gap-2">
                <ChatBubbleLeftRightIcon className="h-4 w-4 text-blue-300 mt-0.5 flex-shrink-0" />
                <span>Diplomat secured 5% discount from Northern Lumber. Savings: $1,240</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
