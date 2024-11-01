'use client'

import { useState, useEffect, useTransition } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AdditionalRequest, answerRequestWithFile, answerRequestWithNumber, answerRequestWithText } from '@/actions/applications'

export default function AdditionalResponses({ applicationId, domain, additionalRequests = [] }: { additionalRequests: AdditionalRequest[]; applicationId: number, domain: string }) {
  const [requests, setRequests] = useState<AdditionalRequest[]>(additionalRequests)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [_, startTransition] = useTransition()

  useEffect(() => {
    if (additionalRequests.length) {
      setIsOpen(true)
    }
  }, [])

  const handleTextResponse = (response: string, requestId: string, form: HTMLFormElement) => {
    startTransition(async () => {
      await answerRequestWithText(domain, applicationId, requestId, response);

      setRequests(r => r.filter(r => r.id !== requestId))

      form.reset()
    })
  }

  const handleFileResponse = (response: string, requestId: string, form: HTMLFormElement, fileName: string) => {
    startTransition(async () => {
      await answerRequestWithFile(domain, applicationId, requestId, response, fileName);

      setRequests(r => r.filter(r => r.id !== requestId))

      form.reset()
    });
  }

  const handleFileUpload = (requestId: string, target: any, form: HTMLFormElement, fileName: string) => {
    const file = target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result.toString().split(',')[1] as string
        handleFileResponse(content, requestId, form, fileName)
      }
      reader.readAsDataURL(file)
    }
  }

  if (requests.length === 0) {
    return null
  }


  if (!requests.length) {
    return null
  }

  const [currentRequest] = requests;

  return (
    <Dialog open={!!requests.length} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Additional Information Required</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={async (e) => {
          e.preventDefault();
          let response: any = null;

          switch (currentRequest.type) {
            case 'text':
              response = (e.target as HTMLFormElement).response.value;
              break;
            case 'number':
              response = Number((e.target as HTMLFormElement).response.value);
              break;
            case 'file':
              response = (e.target as HTMLFormElement).response as HTMLInputElement;
              break;
            default:
              console.error('Unsupported request type');
              return;
          }

          if (response !== null) {
            if (currentRequest.type === 'file') {
              const fileName = response.files[0].name as string

              handleFileUpload(currentRequest.id, response, e.target as any, fileName)
            } else {
              handleTextResponse(response.toString(), currentRequest.id, e.target as any)
            }
          }

        }}>
          <p>{currentRequest.request}</p>
          {currentRequest.type === 'text' && (
            <div className="space-y-2">
              <Label htmlFor="text-input">Enter text:</Label>
              <Input
                required
                id="response"
                name="response"
                type="text"
                placeholder="Enter your response"
              />
            </div>
          )}
          {currentRequest.type === 'number' && (
            <div className="space-y-2">
              <Label htmlFor="number-input">Enter number:</Label>
              <Input
                required
                id="response"
                name="response"
                placeholder="Enter a number"
              />
            </div>
          )}
          {currentRequest.type === 'file' && (
            <div className="space-y-2">
              <Label htmlFor="file-input">Upload file:</Label>
              <Input
                required
                id="response"
                name="response"
                type="file"
              />
            </div>
          )}
          <div className="flex justify-between">
            <Button
              type='submit'
            >
              Submit And {requests.length > 1 ? 'Next' : 'Close'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}