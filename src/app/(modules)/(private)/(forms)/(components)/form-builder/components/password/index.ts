import { KeyRound } from 'lucide-react';
import { FormComponentDefinition } from '../../types';
import { PasswordToolbar } from './toolbar';
import { PasswordCanvas } from './canvas';
import { PasswordProperties } from './properties';

export const passwordComponent: FormComponentDefinition = {
  type: 'password',
  label: 'Password',
  icon: KeyRound,
  toolbar: PasswordToolbar,
  canvas: PasswordCanvas,
  properties: PasswordProperties,
}; 