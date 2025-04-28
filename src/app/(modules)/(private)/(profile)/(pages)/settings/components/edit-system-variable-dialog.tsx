'use client';

import { useState, useEffect } from 'react';
import { SystemVariable, SystemVariableType } from '@/lib/entities';
import { updateSystemVariable } from '../actions';
import { useRouter } from 'next/navigation';
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

interface EditSystemVariableDialogProps {
  variable: SystemVariable | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditSystemVariableDialog({ 
  variable, 
  open, 
  onOpenChange 
}: EditSystemVariableDialogProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [value, setValue] = useState<any>('');
  const [isProtected, setIsProtected] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when variable changes
  useEffect(() => {
    if (variable) {
      setName(variable.name);
      setDescription(variable.description);
      setValue(variable.type === 'json' ? JSON.stringify(variable.value, null, 2) : variable.value);
      setIsProtected(variable.isProtected);
      setError(null);
    }
  }, [variable]);

  const validateValue = (type: SystemVariableType, val: any): any => {
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
    
    if (!variable) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const validatedValue = validateValue(variable.type, value);
      
      await updateSystemVariable(variable.id, {
        name,
        description,
        value: validatedValue,
        isProtected,
      });
      
      onOpenChange(false);
      router.refresh();
    } catch (error: any) {
      console.error('Failed to update variable:', error);
      setError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!variable) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit System Variable</DialogTitle>
            <DialogDescription>
              Update the system variable details and value
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
              <Label htmlFor="value">Value ({String(variable.type)})</Label>
              {variable.type === 'json' || variable.type === 'array' ? (
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
              ) : variable.type === 'boolean' ? (
                <Switch
                  checked={value === true}
                  onCheckedChange={(checked) => setValue(checked)}
                />
              ) : (
                <Input
                  id="value"
                  type={variable.type === 'number' ? 'number' : 'text'}
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
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 