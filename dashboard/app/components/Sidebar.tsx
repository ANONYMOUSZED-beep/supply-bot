'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import {
  HomeIcon,
  CubeIcon,
  TruckIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  CogIcon,
  UserGroupIcon,
  ChartBarIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Inventory', href: '/inventory', icon: CubeIcon },
  { name: 'Suppliers', href: '/suppliers', icon: TruckIcon },
  { name: 'Negotiations', href: '/negotiations', icon: ChatBubbleLeftRightIcon },
  { name: 'Orders', href: '/orders', icon: DocumentTextIcon },
  { name: 'Analytics', href: '/analytics', icon: ChartBarIcon },
  { name: 'Federation', href: '/federation', icon: UserGroupIcon },
  { name: 'Settings', href: '/settings', icon: CogIcon },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-gray-900 text-white flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <CubeIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Supply-Bot</h1>
            <p className="text-xs text-gray-400">Autonomous Procurement</p>
          </div>
        </div>
      </div>

      {/* User Info */}
      {user && (
        <div className="px-6 py-3 border-b border-gray-800">
          <p className="text-sm font-medium text-white truncate">{user.name}</p>
          <p className="text-xs text-gray-400 truncate">{user.organization?.name}</p>
        </div>
      )}

      {/* Navigation */}
      <nav className="mt-6 px-3">
        <ul className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Agent Status */}
      <div className="p-4 border-t border-gray-800">
        <div className="text-xs text-gray-400 mb-3">Agent Status</div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-300">Scout</span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-gray-400">Active</span>
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-300">Strategist</span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-gray-400">Active</span>
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-300">Diplomat</span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-gray-400">Active</span>
            </span>
          </div>
        </div>
      </div>

      {/* Logout Button */}
      <div className="p-4 border-t border-gray-800">
        <button
          onClick={logout}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white rounded-lg transition-colors"
        >
          <ArrowRightOnRectangleIcon className="h-5 w-5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
