'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Upload } from "lucide-react"
import React from 'react'
import { sendContract } from '@/actions/applications'

export function SendContractButton({ domain, applicationId, onDone }: { domain: string, applicationId: number, onDone?: () => unknown }) {
  const [isOpen, setIsOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [_, startTransition] = React.useTransition();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0])
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!file) return
    setSending(true);
    startTransition(async () => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        if (e.target?.result) {
          try {
            const base64String = e.target.result.toString().split(',')[1];
            await sendContract(domain, applicationId, base64String);
            setIsOpen(false);
            setFile(null);
            onDone?.();
          } catch (error) {
            console.error(error);
          }
          setSending(false);
        }
      };
      reader.readAsDataURL(file);

    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Send Contract</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Upload Contract</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="contract">PDF Contract</Label>
            <div className="flex items-center gap-2">
              <input
                id="contract"
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                disabled={sending}
                onClick={() => document.getElementById('contract')?.click()}
              >
                Choose File
              </Button>
              <span className="text-sm text-gray-500">
                {file ? file.name : 'No file chosen'}
              </span>
            </div>
          </div>
          <Button type="submit" disabled={!file || sending} className="w-full">
            <Upload className="mr-2 h-4 w-4" /> Send Contract
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}