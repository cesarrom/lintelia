'use client';

import { useQuery } from '@tanstack/react-query';
import { getSystemVariables } from '@/app/(modules)/(private)/(profile)/(pages)/settings/actions';

export const useSystemVariables = () => {
  return useQuery({
    queryKey: ['system-variables'],
    queryFn: () => getSystemVariables(),
  });
};
