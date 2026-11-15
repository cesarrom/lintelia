'use client';

import { ReactNode } from 'react';

interface PropertyWrapperProps {
  children: ReactNode;
}

export function PropertyWrapper({ children }: PropertyWrapperProps) {
  return <div className="space-y-2">{children}</div>;
} 