'use client';

import { useState } from 'react';
import {
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CurrencyDollarIcon,
  ClockIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState('30d');

  const metrics = [
    {
      name: 'Total Savings',
      value: '$12,450',
      change: '+18.2%',
      trend: 'up',
      icon: CurrencyDollarIcon,
      color: 'green',
    },
    {
      name: 'Avg. Procurement Time',
      value: '2.3 days',
      change: '-24%',
      trend: 'down',
      icon: ClockIcon,
      color: 'blue',
    },
    {
      name: 'Supplier Response Rate',
      value: '94%',
      change: '+5%',
      trend: 'up',
      icon: TruckIcon,
      color: 'purple',
    },
    {
      name: 'Negotiation Success',
      value: '78%',
      change: '+12%',
      trend: 'up',
      icon: ChartBarIcon,
      color: 'yellow',
    },
  ];

  const savingsData = [
    { month: 'Jun', amount: 1200 },
    { month: 'Jul', amount: 1800 },
    { month: 'Aug', amount: 2100 },
    { month: 'Sep', amount: 1950 },
    { month: 'Oct', amount: 2800 },
    { month: 'Nov', amount: 2600 },
  ];

  const categorySpending = [
    { category: 'Raw Materials', spent: 45000, budget: 50000 },
    { category: 'Hardware', spent: 12000, budget: 15000 },
    { category: 'Finishes', spent: 8500, budget: 10000 },
    { category: 'Packaging', spent: 4200, budget: 5000 },
  ];

  const topSuppliers = [
    { name: 'Northern Lumber Co.', orders: 24, value: '$28,500', rating: 4.8 },
    { name: 'Hardware Supply Direct', orders: 18, value: '$12,200', rating: 4.6 },
    { name: 'Premium Finishes Inc.', orders: 12, value: '$9,800', rating: 4.5 },
    { name: 'Eco Packaging Solutions', orders: 8, value: '$4,200', rating: 4.7 },
  ];

  const maxSavings = Math.max(...savingsData.map(d => d.amount));

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500">Track your procurement performance and savings</p>
        </div>
        <div className="flex gap-2">
          {['7d', '30d', '90d', '1y'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 text-sm rounded-lg ${
                timeRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {metrics.map((metric) => (
          <div key={metric.name} className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">{metric.name}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{metric.value}</p>
              </div>
              <div className={`h-10 w-10 bg-${metric.color}-50 rounded-lg flex items-center justify-center`}>
                <metric.icon className={`h-5 w-5 text-${metric.color}-600`} />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2">
              {metric.trend === 'up' ? (
                <ArrowTrendingUpIcon className="h-4 w-4 text-green-500" />
              ) : (
                <ArrowTrendingDownIcon className="h-4 w-4 text-green-500" />
              )}
              <span className="text-xs text-green-600">{metric.change} vs last period</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Savings Chart */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Monthly Savings</h3>
          <div className="flex items-end gap-3 h-48">
            {savingsData.map((data) => (
              <div key={data.month} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-blue-500 rounded-t-sm"
                  style={{ height: `${(data.amount / maxSavings) * 160}px` }}
                ></div>
                <span className="text-xs text-gray-500 mt-2">{data.month}</span>
                <span className="text-xs font-medium text-gray-700">${(data.amount / 1000).toFixed(1)}k</span>
              </div>
            ))}
          </div>
        </div>

        {/* Budget vs Spending */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Budget vs Spending</h3>
          <div className="space-y-4">
            {categorySpending.map((cat) => {
              const percentage = (cat.spent / cat.budget) * 100;
              return (
                <div key={cat.category}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700">{cat.category}</span>
                    <span className="text-gray-500">
                      ${(cat.spent / 1000).toFixed(1)}k / ${(cat.budget / 1000).toFixed(1)}k
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        percentage > 90 ? 'bg-red-500' : percentage > 75 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top Suppliers Table */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Top Performing Suppliers</h3>
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase tracking-wide">
              <th className="pb-3">Supplier</th>
              <th className="pb-3">Orders</th>
              <th className="pb-3">Total Value</th>
              <th className="pb-3">Rating</th>
              <th className="pb-3">Performance</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {topSuppliers.map((supplier, idx) => (
              <tr key={supplier.name} className="border-t border-gray-100">
                <td className="py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-600">
                      {idx + 1}
                    </div>
                    <span className="font-medium text-gray-900">{supplier.name}</span>
                  </div>
                </td>
                <td className="py-3 text-gray-600">{supplier.orders}</td>
                <td className="py-3 font-medium text-gray-900">{supplier.value}</td>
                <td className="py-3">
                  <div className="flex items-center gap-1">
                    <span className="text-yellow-500">★</span>
                    <span className="text-gray-700">{supplier.rating}</span>
                  </div>
                </td>
                <td className="py-3">
                  <div className="h-2 w-24 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${supplier.rating * 20}%` }}
                    ></div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
