'use client'
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export default function SignupPage() {
  const [formData, setFormData] = useState({
    institutionName: '',
    subdomain: '',
    adminEmail: '',
    adminName: '',
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const response = await fetch('/api/tenants/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to create tenant');
      }

      // Redirect to the new tenant's subdomain
      const protocol = window.location.protocol;
      const domain = window.location.host.split('.').slice(1).join('.');
      window.location.href = `${protocol}//${formData.subdomain}.${domain}/dashboard`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <div className="container mx-auto max-w-md p-6">
      <h1 className="text-2xl font-bold mb-6">Register Your Institution</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="institutionName">Institution Name</Label>
          <Input
            id="institutionName"
            name="institutionName"
            value={formData.institutionName}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <Label htmlFor="subdomain">Subdomain</Label>
          <Input
            id="subdomain"
            name="subdomain"
            value={formData.subdomain}
            onChange={handleChange}
            pattern="[a-z0-9-]+"
            title="Only lowercase letters, numbers, and hyphens are allowed"
            required
          />
          <p className="text-sm text-gray-500 mt-1">
            Your URL will be: {formData.subdomain}.yourdomain.com
          </p>
        </div>

        <div>
          <Label htmlFor="adminName">Admin Name</Label>
          <Input
            id="adminName"
            name="adminName"
            value={formData.adminName}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <Label htmlFor="adminEmail">Admin Email</Label>
          <Input
            id="adminEmail"
            name="adminEmail"
            type="email"
            value={formData.adminEmail}
            onChange={handleChange}
            required
          />
        </div>

        <Button type="submit" className="w-full">
          Create Institution
        </Button>
      </form>
    </div>
  );
} 