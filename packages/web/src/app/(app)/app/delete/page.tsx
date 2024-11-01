'use client'

import React, { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { AlertTriangle } from "lucide-react"
import { deleteTenant } from '@/actions/tenants'
import { useTenant } from '@/providers/tenant/tenant.provider'
import { useUser } from '@descope/nextjs-sdk/client'

export default function Component() {
  const { tenant } = useTenant();
  const { user } = useUser();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [_, startTransition] = React.useTransition();

  const handleDeleteOrganization = () => {
    console.log('Tenant deleted')
    setIsDeleteModalOpen(false);

    startTransition(async () => {
      await deleteTenant(tenant.domain, user.userId);
      window.location.href = '/';
    })
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Organization Settings</h1>

      <div className="bg-red-50 border-2 border-red-500 rounded-lg p-6 mt-8">
        <h2 className="text-2xl font-semibold text-red-700 mb-4">Danger Zone</h2>
        <p className="text-red-600 mb-4">
          Deleting your Organization is a permanent action. All your data will be permanently removed and cannot be recovered.
        </p>
        <Button
          variant="destructive"
          onClick={() => setIsDeleteModalOpen(true)}
          className="bg-red-600 hover:bg-red-700 text-white font-bold"
        >
          Delete Organization
        </Button>
      </div>

      <AlertDialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 flex items-center">
              <AlertTriangle className="mr-2" />
              Delete Organization Permanently
            </AlertDialogTitle>
            <AlertDialogDescription className="text-red-500">
              This action cannot be undone. This will permanently delete your Organization and remove all associated data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4">
            <Label htmlFor="confirmDelete" className="text-sm font-medium">
              Type "DELETE" to confirm:
            </Label>
            <Input
              id="confirmDelete"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="mt-1"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOrganization}
              disabled={confirmText !== 'DELETE'}
              className="bg-red-600 hover:bg-red-700 text-white font-bold"
            >
              Delete Organization
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}