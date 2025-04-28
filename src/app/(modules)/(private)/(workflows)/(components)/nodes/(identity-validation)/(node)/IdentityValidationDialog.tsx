'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { IdentityValidationNodeData, ValidationType } from '../types';
import { DialogProps } from '../../types';
import { useNodeData } from '../../../WorkflowContext';
import { VariableInput } from '@/components/ui/variable-input';

const DOCUMENT_TYPES: Array<{ value: ValidationType; label: string }> = [
  { value: 'national_identity_card', label: 'National Identity Card' },
  { value: 'passport', label: 'Passport' },
  { value: 'driving_license', label: "Driver's License" },
  { value: 'national_insurance_number', label: 'National Insurance Number' },
  { value: 'social_security_number', label: 'Social Security Number' },
  { value: 'tax_identification_number', label: 'Tax Identification Number' },
  { value: 'utility_bill', label: 'Utility Bill' },
  { value: 'visa', label: 'Visa' },
  { value: 'polling_card', label: 'Polling Card' },
  { value: 'residence_permit', label: 'Residence Permit' },
  { value: 'birth_certificate', label: 'Birth Certificate' },
  { value: 'bank_statement', label: 'Bank Statement' },
  { value: 'change_of_name', label: 'Change of Name' },
  { value: 'tax_document', label: 'Tax Document' },
  { value: 'company_confirmation_statement', label: 'Company Confirmation Statement' },
  { value: 'company_annual_accounts', label: 'Company Annual Accounts' },
  { value: 'company_statement_of_capital', label: 'Company Statement of Capital' },
  { value: 'company_change_of_address', label: 'Company Change of Address' },
  { value: 'company_incorporation', label: 'Company Incorporation' },
  { value: 'company_change_of_officers', label: 'Company Change of Officers' },
  { value: 'company_change_of_beneficial_owners', label: 'Company Change of Beneficial Owners' },
  { value: 'unknown', label: 'Unknown' },
  { value: 'other', label: 'Other' },
];

export function IdentityValidationDialog({ open, onOpenChange, data, onSave }: DialogProps) {
  const [nodeData, setNodeData] = useNodeData();

  const [idTypeFromVariable, setIdTypeFromVariable] = useState(false);

  if (!nodeData) {
    return null;
  }

  const config = (nodeData.config || {
    documentType: 'national_identity_card',
    selfieFile: '',
    frontFile: '',
    backFile: '',
  }) as IdentityValidationNodeData;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Identity Validation Configuration</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={nodeData.name}
                onChange={(e) => setNodeData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter node name"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={nodeData.description || ''}
                onChange={(e) => setNodeData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter node description"
              />
            </div>
          </div>

          {/* Document Configuration */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Document Type</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={idTypeFromVariable}
                    onCheckedChange={setIdTypeFromVariable}
                    id="id-type-source"
                  />
                  <Label htmlFor="id-type-source">Use variable for document type</Label>
                </div>

                {idTypeFromVariable ? (
                  <VariableInput
                    value={config.documentType}
                    onChange={(value) => setNodeData(prev => ({
                      ...prev,
                      config: {
                        ...prev.config,
                        documentType: value,
                      },
                    }))}
                    placeholder="Select variable for document type"
                  />
                ) : (
                  <Select
                    value={config.documentType || ' '}
                    onValueChange={(value: ValidationType) => setNodeData(prev => ({
                      ...prev,
                      config: {
                        ...prev.config,
                        documentType: value,
                      },
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <div className="flex flex-col">
              <Label>Required Images</Label>
              <div className="flex flex-col gap-2">
                <div>
                  <Label>Selfie Image</Label>
                  <VariableInput
                    value={config.selfieFile || ''}
                    onChange={(value) => setNodeData(prev => ({
                      ...prev,
                      config: {
                        ...prev.config,
                        selfieFile: value,
                      },
                    }))}
                  />
                </div>
                <div>
                  <Label>Document Front</Label>
                  <VariableInput
                    value={config.frontFile || ''}
                    onChange={(value) => setNodeData(prev => ({
                      ...prev,
                      config: {
                        ...prev.config,
                        frontFile: value,
                      },
                    }))}
                  />
                </div>
                <div>
                  <Label>Document Back (Optional)</Label>
                  <VariableInput
                    value={config.backFile || ''}
                    onChange={(value) => setNodeData(prev => ({
                      ...prev,
                      config: {
                        ...prev.config,
                        backFile: value,
                      },
                    }))}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 