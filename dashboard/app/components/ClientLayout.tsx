'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { token, isLoading } = useAuth();

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't show sidebar on login page
  if (pathname === '/login') {
    return <>{children}</>;
  }

  // Show sidebar for authenticated users
  if (token) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 ml-64">{children}</main>
      </div>
    );
  }

  // Unauthenticated - will redirect to login via AuthContext
  return <>{children}</>;
}
