'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';
import InviteUserDialog from './invite-user-dialog';

export default function InviteUserButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="mr-2 h-4 w-4" />
        Invite User
      </Button>
      <InviteUserDialog
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
} 