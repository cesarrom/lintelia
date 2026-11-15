'use client';

import { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Editor } from '@monaco-editor/react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ValueType } from '@repo/fintivio/schemas';
import { useSystemSetSystemVariable } from '@/lib/services/system.hooks';

interface CreateSystemVariableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const VARIABLE_TYPES: { label: string; value: ValueType }[] = [
  { label: 'String', value: 'string' },
  { label: 'Number', value: 'number' },
  { label: 'Boolean', value: 'boolean' },
  { label: 'JSON', value: 'json' },
  { label: 'Array', value: 'array' },
];

export default function CreateSystemVariableDialog({ 
  open, 
  onOpenChange 
}: CreateSystemVariableDialogProps) {
  const { mutateAsync: createSystemVariable } = useSystemSetSystemVariable();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ValueType>('string');
  const [value, setValue] = useState<any>('');
  const [isProtected, setIsProtected] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateValue = (type: ValueType, val: any): any => {
    try {
      switch (type) {
        case 'string':
          return String(val);
        case 'number':
          const num = Number(val);
          if (isNaN(num)) throw new Error('Invalid number');
          return num;
        case 'boolean':
          return Boolean(val);
        case 'json':
          return JSON.parse(val);
        case 'array':
          const arr = JSON.parse(val);
          if (!Array.isArray(arr)) throw new Error('Value must be an array');
          return arr;
        default:
          throw new Error('Invalid type');
      }
    } catch (error: any) {
      throw new Error(`Invalid value for type ${type}: ${error.message}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const validatedValue = validateValue(type, value);
      
      await createSystemVariable({
        name,
        description,
        type,
        value: validatedValue,
        isProtected,
      });
      
      onOpenChange(false);
      setName('');
      setDescription('');
      setType('string');
      setValue('');
      setIsProtected(false);
      window.location.reload();
    } catch (error: any) {
      console.error('Failed to create variable:', error);
      setError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create System Variable</DialogTitle>
            <DialogDescription>
              Create a new system variable with a specific type and value
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="type">Type</Label>
              <Select
                value={String(type)}
                onValueChange={(value: string) => {
                  setType(value as SystemVariableType);
                  setValue('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a type" />
                </SelectTrigger>
                <SelectContent>
                  {VARIABLE_TYPES.map((type) => (
                    <SelectItem key={String(type.value)} value={String(type.value)}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="value">Value</Label>
              {type === 'json' || type === 'array' ? (
                <div className="border rounded-md">
                  <Editor
                    height="200px"
                    defaultLanguage="json"
                    value={value}
                    onChange={(val) => setValue(val || '')}
                    options={{
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      lineNumbers: 'off',
                      folding: false,
                      tabSize: 2,
                    }}
                  />
                </div>
              ) : type === 'boolean' ? (
                <Switch
                  checked={value === true}
                  onCheckedChange={(checked) => setValue(checked)}
                />
              ) : (
                <Input
                  id="value"
                  type={type === 'number' ? 'number' : 'text'}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  required
                />
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="protected"
                checked={isProtected}
                onCheckedChange={setIsProtected}
              />
              <Label htmlFor="protected">Protected (prevent deletion)</Label>
            </div>

            {error && (
              <p className="text-sm text-red-500">
                {error}
              </p>
            )}
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Variable'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 