'use client';

import { createContext, useContext } from 'react';
import { FormVariable } from '../types';

interface VariablesContextValue {
  variables: Record<string, unknown>;
  definitions: Record<string, FormVariable>;
}

const VariablesContext = createContext<VariablesContextValue>({
  variables: {},
  definitions: {},
});

export const useVariables = () => useContext(VariablesContext);

export const VariablesProvider = VariablesContext.Provider; 