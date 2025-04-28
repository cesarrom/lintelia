'use client';

import { useState, useEffect } from 'react';
import { FormAnswer } from '@/lib/entities';

interface UseFormAnswersResult {
  answers: FormAnswer[];
  isLoading: boolean;
  error: Error | null;
}

export function useFormAnswers(formId: string, instanceId: string): UseFormAnswersResult {
  const [answers, setAnswers] = useState<FormAnswer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchAnswers = async () => {
      try {
        const response = await fetch(`/api/forms/${formId}/instances/${instanceId}/answers`);
        if (!response.ok) {
          throw new Error('Failed to fetch answers');
        }
        const data = await response.json();
        setAnswers(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An error occurred'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnswers();
  }, [formId, instanceId]);

  return { answers, isLoading, error };
} 