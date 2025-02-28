'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { inviteUser } from '../actions';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { getRoles } from '@/app/(modules)/(private)/(profile)/(pages)/roles/actions';
import { Role } from '@/lib/auth/roles';
import { Checkbox } from '@/components/ui/checkbox';

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function InviteUserDialog({ 
  open, 
  onOpenChange 
}: InviteUserDialogProps) {
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch available roles
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        setIsLoading(true);
        const data = await getRoles();
        setRoles(data);
      } catch (error) {
        console.error('Failed to fetch roles:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRoles();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsSubmitting(true);
    
    try {
      await inviteUser({
        email,
        name,
        roleIds: selectedRoles
      });
      onOpenChange(false);
      setEmail('');
      setName('');
      setSelectedRoles([]);
      router.refresh();
    } catch (error) {
      console.error('Failed to invite user:', error);
      alert('Failed to invite user. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleRole = (roleId: string) => {
    setSelectedRoles(current => 
      current.includes(roleId)
        ? current.filter(id => id !== roleId)
        : [...current, roleId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
            <DialogDescription>
              Send an invitation to a new user
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            
            <div className="grid gap-2">
              <Label>Roles</Label>
              {isLoading ? (
                <div className="text-sm text-muted-foreground">Loading roles...</div>
              ) : (
                <div className="grid gap-2">
                  {roles.map((role) => (
                    <div key={role.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={role.id}
                        checked={selectedRoles.includes(role.id)}
                        onCheckedChange={() => toggleRole(role.id)}
                        disabled={role.isSystem && role.id === 'super_admin'}
                      />
                      <Label
                        htmlFor={role.id}
                        className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {role.name}
                        {role.isSystem && (
                          <span className="ml-2 text-xs text-muted-foreground">(System Role)</span>
                        )}
                      </Label>
                    </div>
                  ))}
                  {roles.length === 0 && (
                    <div className="text-sm text-muted-foreground">
                      No roles available. Create some roles first.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || isLoading}>
              {isSubmitting ? 'Inviting...' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 