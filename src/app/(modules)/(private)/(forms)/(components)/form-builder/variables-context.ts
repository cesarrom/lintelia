import { createContext, useContext } from 'react';
import { FormVariable } from './schemas';

export interface VariablesContextValue {
  values: Record<string, unknown>;
  definitions: Record<string, FormVariable>;
  variables: Record<string, unknown>;
}

const VariablesContext = createContext<VariablesContextValue>({
  values: {},
  definitions: {},
  variables: {},
});

export const VariablesProvider = VariablesContext.Provider;

export function useVariables() {
  return useContext(VariablesContext);
} 