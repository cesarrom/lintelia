'use client';

import { useEffect, useState } from 'react';
import { FormInstance } from '@/lib/entities';
import { getFormInstances } from '../../../../(actions)/actions';

export function useFormInstances(formId: string) {
  const [instances, setInstances] = useState<FormInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchInstances = async () => {
      try {
        const data = await getFormInstances(formId);
        setInstances(data);
      } catch (error) {
        console.error('Failed to fetch form instances:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInstances();
  }, [formId]);

  return { instances, isLoading };
} 