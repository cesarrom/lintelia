'use client';

import { FormVariable } from '@repo/fintivio/schemas';
import { createContext, useContext } from 'react';

interface VariablesContextValue {
  variables: Record<string, unknown>;
  definitions: Record<string, FormVariable>;
}

const VariablesContext = createContext<VariablesContextValue>({
  variables: {},
  definitions: {},
});

export const useVariables = () => useContext(VariablesContext);

export const VariablesProvider = ({
  variables,
  definitions,
  children,
}: {
  variables: Record<string, unknown>;
  definitions: Record<string, FormVariable>;
  children: React.ReactNode;
}) => <VariablesContext.Provider value={{ variables, definitions }}>{children}</VariablesContext.Provider>;