'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BuildingStorefrontIcon,
  CubeIcon,
  TruckIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

interface BusinessInfo {
  companyName: string;
  industry: string;
  size: string;
  productsDescription: string;
}

interface SupplierInfo {
  name: string;
  website: string;
  email: string;
  category: string;
}

interface ProductInfo {
  name: string;
  sku: string;
  category: string;
  currentStock: number;
  reorderPoint: number;
  unit: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  const [business, setBusiness] = useState<BusinessInfo>({
    companyName: '',
    industry: '',
    size: '',
    productsDescription: '',
  });

  const [suppliers, setSuppliers] = useState<SupplierInfo[]>([
    { name: '', website: '', email: '', category: '' }
  ]);

  const [products, setProducts] = useState<ProductInfo[]>([
    { name: '', sku: '', category: '', currentStock: 0, reorderPoint: 0, unit: 'units' }
  ]);

  const industries = [
    'Furniture Manufacturing',
    'Metal Fabrication',
    'Food & Beverage',
    'Automotive Parts',
    'Electronics Assembly',
    'Textile & Apparel',
    'Construction Materials',
    'Packaging',
    'Other Manufacturing',
  ];

  const companySizes = [
    { value: 'micro', label: '1-10 employees' },
    { value: 'small', label: '11-50 employees' },
    { value: 'medium', label: '51-200 employees' },
    { value: 'large', label: '200+ employees' },
  ];

  const addSupplier = () => {
    setSuppliers([...suppliers, { name: '', website: '', email: '', category: '' }]);
  };

  const removeSupplier = (index: number) => {
    setSuppliers(suppliers.filter((_, i) => i !== index));
  };

  const updateSupplier = (index: number, field: keyof SupplierInfo, value: string) => {
    const updated = [...suppliers];
    updated[index][field] = value;
    setSuppliers(updated);
  };

  const addProduct = () => {
    setProducts([...products, { name: '', sku: '', category: '', currentStock: 0, reorderPoint: 0, unit: 'units' }]);
  };

  const removeProduct = (index: number) => {
    setProducts(products.filter((_, i) => i !== index));
  };

  const updateProduct = (index: number, field: keyof ProductInfo, value: string | number) => {
    const updated = [...products];
    (updated[index] as any)[field] = value;
    setProducts(updated);
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // Save business info
      await fetch('http://localhost:3001/api/onboarding/business', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(business),
      });

      // Save suppliers
      for (const supplier of suppliers.filter(s => s.name)) {
        await fetch('http://localhost:3001/api/suppliers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(supplier),
        });
      }

      // Save products
      for (const product of products.filter(p => p.name)) {
        await fetch('http://localhost:3001/api/inventory', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(product),
        });
      }

      router.push('/');
    } catch (error) {
      console.error('Onboarding error:', error);
      // Still redirect for demo
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                  step >= s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}
              >
                {step > s ? <CheckCircleIcon className="h-6 w-6" /> : s}
              </div>
              {s < 3 && (
                <div className={`w-20 h-1 ${step > s ? 'bg-blue-600' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Labels */}
        <div className="flex justify-between mb-8 px-4">
          <span className={`text-sm ${step >= 1 ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
            Your Business
          </span>
          <span className={`text-sm ${step >= 2 ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
            Your Suppliers
          </span>
          <span className={`text-sm ${step >= 3 ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
            Your Products
          </span>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          
          {/* Step 1: Business Info */}
          {step === 1 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <BuildingStorefrontIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Tell us about your business</h2>
                  <p className="text-gray-500">This helps us tailor the AI to your needs</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
                  <input
                    type="text"
                    value={business.companyName}
                    onChange={(e) => setBusiness({ ...business, companyName: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Acme Manufacturing Co."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Industry</label>
                  <select
                    value={business.industry}
                    onChange={(e) => setBusiness({ ...business, industry: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select your industry</option>
                    {industries.map((ind) => (
                      <option key={ind} value={ind}>{ind}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company Size</label>
                  <div className="grid grid-cols-2 gap-3">
                    {companySizes.map((size) => (
                      <button
                        key={size.value}
                        type="button"
                        onClick={() => setBusiness({ ...business, size: size.value })}
                        className={`px-4 py-3 border rounded-lg text-left ${
                          business.size === size.value
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {size.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    What do you manufacture/sell?
                  </label>
                  <textarea
                    value={business.productsDescription}
                    onChange={(e) => setBusiness({ ...business, productsDescription: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="E.g., Custom wooden furniture, chairs, tables, cabinets..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Suppliers */}
          {step === 2 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-green-100 rounded-lg">
                  <TruckIcon className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Add your suppliers</h2>
                  <p className="text-gray-500">We'll monitor their prices and negotiate for you</p>
                </div>
              </div>

              <div className="space-y-4">
                {suppliers.map((supplier, index) => (
                  <div key={index} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-medium text-gray-700">Supplier {index + 1}</span>
                      {suppliers.length > 1 && (
                        <button
                          onClick={() => removeSupplier(index)}
                          className="text-red-500 text-sm hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={supplier.name}
                        onChange={(e) => updateSupplier(index, 'name', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Supplier name"
                      />
                      <input
                        type="text"
                        value={supplier.category}
                        onChange={(e) => updateSupplier(index, 'category', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Category (e.g., Lumber)"
                      />
                      <input
                        type="url"
                        value={supplier.website}
                        onChange={(e) => updateSupplier(index, 'website', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Website URL"
                      />
                      <input
                        type="email"
                        value={supplier.email}
                        onChange={(e) => updateSupplier(index, 'email', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Sales email"
                      />
                    </div>
                  </div>
                ))}

                <button
                  onClick={addSupplier}
                  className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-500"
                >
                  + Add Another Supplier
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Products */}
          {step === 3 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <CubeIcon className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Add your inventory</h2>
                  <p className="text-gray-500">We'll track stock levels and auto-reorder when needed</p>
                </div>
              </div>

              <div className="space-y-4">
                {products.map((product, index) => (
                  <div key={index} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-medium text-gray-700">Product {index + 1}</span>
                      {products.length > 1 && (
                        <button
                          onClick={() => removeProduct(index)}
                          className="text-red-500 text-sm hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <input
                        type="text"
                        value={product.name}
                        onChange={(e) => updateProduct(index, 'name', e.target.value)}
                        className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Product name"
                      />
                      <input
                        type="text"
                        value={product.sku}
                        onChange={(e) => updateProduct(index, 'sku', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="SKU"
                      />
                      <input
                        type="text"
                        value={product.category}
                        onChange={(e) => updateProduct(index, 'category', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Category"
                      />
                      <input
                        type="number"
                        value={product.currentStock || ''}
                        onChange={(e) => updateProduct(index, 'currentStock', parseInt(e.target.value) || 0)}
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Current stock"
                      />
                      <input
                        type="number"
                        value={product.reorderPoint || ''}
                        onChange={(e) => updateProduct(index, 'reorderPoint', parseInt(e.target.value) || 0)}
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Reorder at"
                      />
                    </div>
                  </div>
                ))}

                <button
                  onClick={addProduct}
                  className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-500"
                >
                  + Add Another Product
                </button>

                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    💡 <strong>Tip:</strong> You can also import from CSV or connect to QuickBooks later in Settings.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t">
            <button
              onClick={() => setStep(step - 1)}
              disabled={step === 1}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg ${
                step === 1
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <ArrowLeftIcon className="h-5 w-5" />
              Back
            </button>

            {step < 3 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Continue
                <ArrowRightIcon className="h-5 w-5" />
              </button>
            ) : (
              <button
                onClick={handleComplete}
                disabled={loading}
                className="flex items-center gap-2 px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Setting up...' : '🚀 Launch Supply-Bot'}
              </button>
            )}
          </div>
        </div>

        {/* Skip for now */}
        <div className="text-center mt-6">
          <button
            onClick={() => router.push('/')}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            Skip for now, I'll set this up later
          </button>
        </div>
      </div>
    </div>
  );
}
