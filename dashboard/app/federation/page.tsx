'use client';

import { useState } from 'react';
import {
  UserGroupIcon,
  BuildingOfficeIcon,
  LinkIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlusIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

interface FederatedPartner {
  id: string;
  name: string;
  type: 'manufacturer' | 'distributor' | 'cooperative';
  status: 'active' | 'pending' | 'inactive';
  sharedCategories: string[];
  memberSince: string;
  savingsGenerated: number;
  lastSync: string;
}

export default function FederationPage() {
  const [showAddModal, setShowAddModal] = useState(false);

  const partners: FederatedPartner[] = [
    {
      id: '1',
      name: 'Midwest Furniture Collective',
      type: 'cooperative',
      status: 'active',
      sharedCategories: ['Lumber', 'Hardware', 'Finishes'],
      memberSince: '2024-06-15',
      savingsGenerated: 8450,
      lastSync: '2 hours ago',
    },
    {
      id: '2',
      name: 'CustomCraft Studios',
      type: 'manufacturer',
      status: 'active',
      sharedCategories: ['Hardware', 'Packaging'],
      memberSince: '2024-09-01',
      savingsGenerated: 3200,
      lastSync: '30 min ago',
    },
    {
      id: '3',
      name: 'Regional Supply Network',
      type: 'distributor',
      status: 'pending',
      sharedCategories: ['Raw Materials'],
      memberSince: '2024-11-20',
      savingsGenerated: 0,
      lastSync: 'Never',
    },
  ];

  const sharedDeals = [
    {
      id: '1',
      item: 'Walnut Lumber 2x4x8',
      originalPrice: 45.00,
      federatedPrice: 38.50,
      minQuantity: 500,
      participants: 4,
      expiresIn: '5 days',
    },
    {
      id: '2',
      item: 'Polyurethane Clear Coat (5 gal)',
      originalPrice: 220.00,
      federatedPrice: 185.00,
      minQuantity: 50,
      participants: 3,
      expiresIn: '12 days',
    },
    {
      id: '3',
      item: 'Brass Cabinet Hinges (100pk)',
      originalPrice: 89.00,
      federatedPrice: 72.00,
      minQuantity: 200,
      participants: 6,
      expiresIn: '3 days',
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">Active</span>;
      case 'pending':
        return <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded-full">Pending</span>;
      default:
        return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">Inactive</span>;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'cooperative':
        return <UserGroupIcon className="h-5 w-5 text-blue-600" />;
      case 'manufacturer':
        return <BuildingOfficeIcon className="h-5 w-5 text-purple-600" />;
      default:
        return <LinkIcon className="h-5 w-5 text-green-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Federation Network</h1>
          <p className="text-sm text-gray-500">Collaborate with other SMBs for bulk purchasing power</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <PlusIcon className="h-4 w-4" />
          Join Network
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Active Partners</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {partners.filter(p => p.status === 'active').length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Shared Categories</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">4</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Savings</p>
          <p className="text-2xl font-bold text-green-600 mt-1">$11,650</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Active Deals</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{sharedDeals.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Partners List */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Federation Partners</h3>
            <button className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              <ArrowPathIcon className="h-3 w-3" />
              Sync All
            </button>
          </div>
          <div className="space-y-3">
            {partners.map((partner) => (
              <div key={partner.id} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                      {getTypeIcon(partner.type)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{partner.name}</p>
                      <p className="text-xs text-gray-500 capitalize">{partner.type}</p>
                    </div>
                  </div>
                  {getStatusBadge(partner.status)}
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                  <span>Categories: {partner.sharedCategories.join(', ')}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-gray-500">Last sync: {partner.lastSync}</span>
                  {partner.savingsGenerated > 0 && (
                    <span className="text-green-600 font-medium">
                      +${partner.savingsGenerated.toLocaleString()} saved
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Shared Deals */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Available Group Deals</h3>
          <div className="space-y-3">
            {sharedDeals.map((deal) => (
              <div key={deal.id} className="p-3 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{deal.item}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-gray-400 line-through">${deal.originalPrice.toFixed(2)}</span>
                      <span className="text-sm font-bold text-green-600">${deal.federatedPrice.toFixed(2)}</span>
                      <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                        {Math.round((1 - deal.federatedPrice / deal.originalPrice) * 100)}% off
                      </span>
                    </div>
                  </div>
                  <button className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">
                    Join Deal
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                  <span>Min qty: {deal.minQuantity}</span>
                  <span>•</span>
                  <span>{deal.participants} participants</span>
                  <span>•</span>
                  <span className="text-orange-600">Expires in {deal.expiresIn}</span>
                </div>
              </div>
            ))}
          </div>

          {/* How it works */}
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <h4 className="text-xs font-semibold text-blue-900 mb-2">How Federation Works</h4>
            <ul className="text-xs text-blue-700 space-y-1">
              <li className="flex items-start gap-2">
                <CheckCircleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>Pool orders with trusted partners for bulk discounts</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>Share supplier intelligence and pricing data</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>Coordinate negotiations for better leverage</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
