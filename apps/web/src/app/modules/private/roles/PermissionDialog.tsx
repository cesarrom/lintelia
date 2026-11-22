import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { apiErrorMessage, useApiMutation } from '@/lib/services/api';
import type { CatalogEntry } from './RoleDialog';

export const slugKey = (name: string) => {
  const slug = name.trim().toLowerCase().replace(/^custom:/, '').replace(/[^a-z0-9_.-]+/g, '_').replace(/^[^a-z]+/, '').replace(/[_.-]+$/g, '');
  return slug ? `custom:${slug}` : '';
};

/**
 * A custom permission (docs/plans/15 §5.1): the name of a capability of the institution ("Waive fees"). Creating it
 * grants it to nobody; administrators put it in roles.
 */
export function PermissionDialog({ permission, open, onOpenChange, onCreated }: {
  permission: CatalogEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (permission: CatalogEntry) => void;
}) {
  const [name, setName] = useState(permission?.name ?? '');
  const [key, setKey] = useState(permission?.id ?? '');
  const [keyTouched, setKeyTouched] = useState(!!permission);
  const [category, setCategory] = useState(permission?.category ?? '');
  const [description, setDescription] = useState(permission?.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const save = useApiMutation<void, CatalogEntry>(({ axios, url }) => permission
    ? axios.put(url(`/permissions/custom/${encodeURIComponent(permission.id)}`), { name, category, description })
    : axios.post(url('/permissions/custom'), { name, key: key || undefined, category, description }), [['permissions'], ['roles'], ['access', 'matrix'], ['auth', 'me']]);
  const shownKey = keyTouched ? key : slugKey(name);

  const submit = async () => {
    setError(null);
    try {
      const saved = await save.mutateAsync();
      toast.success(permission ? 'Permission updated' : `Permission ${saved.id} created: nobody holds it yet`);
      onCreated?.(saved);
      onOpenChange(false);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{permission ? `Edit ${permission.name}` : 'New custom permission'}</DialogTitle>
          <DialogDescription>A capability of your institution that screens, buttons and workflows can require. Nobody holds it until an administrator adds it to a role.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="permission-name">Name</Label>
            <Input id="permission-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Waive fees" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="permission-key">Key</Label>
            <Input id="permission-key" className="font-mono text-xs" value={shownKey} disabled={!!permission}
              onChange={(e) => { setKeyTouched(true); setKey(e.target.value); }} />
            <p className="text-xs text-muted-foreground">Stable identifier used by workflows and screens. Always starts with <code>custom:</code>.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="permission-category">Category</Label>
            <Input id="permission-category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Servicing" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="permission-description">Description</Label>
            <Textarea id="permission-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
        </div>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!name.trim() || save.isPending}>{permission ? 'Save permission' : 'Create permission'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
