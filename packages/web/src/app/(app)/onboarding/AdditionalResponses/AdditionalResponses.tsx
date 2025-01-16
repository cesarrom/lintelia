'use client'

import { useState, useEffect, useTransition } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AdditionalRequest, answerRequestWithFile, answerRequestWithNumber, answerRequestWithText } from '@/actions/applications'
import { Textarea } from '@/components/ui/textarea'
import { InlineFileViewer } from '../../app/applications/reviews/FileViewer/FileViewer'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronsUpDown } from 'lucide-react'

export default function AdditionalResponses({ domain, additionalRequests = [] }: { additionalRequests: (AdditionalRequest & { applicationId: number })[]; domain: string }) {
  const [requests, setRequests] = useState<(AdditionalRequest & { applicationId: number })[]>(additionalRequests)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [_, startTransition] = useTransition()


  useEffect(() => {
    if (additionalRequests.length) {
      setIsOpen(true)
    }
  }, [])

  if (requests.length === 0) {
    return null
  }


  if (!requests.length) {
    return null
  }

  const [currentRequest] = requests;

  const handleTextResponse = (response: string, requestId: string, form: HTMLFormElement) => {
    startTransition(async () => {
      await answerRequestWithText(domain, currentRequest.applicationId, requestId, response);

      setRequests(r => r.filter(r => r.id !== requestId))

      form.reset()
    })
  }

  const handleFileResponse = (response: string, requestId: string, form: HTMLFormElement, fileName: string) => {
    startTransition(async () => {
      await answerRequestWithFile(domain, currentRequest.applicationId, requestId, response, fileName);

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
          {currentRequest.attachments.length > 0 ? <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className="w-[350px] space-y-2"
          >
            <div className="flex items-center justify-between space-x-4 px-4">
              <h4 className="text-sm font-semibold">
                {currentRequest.attachments.length} Attachments
              </h4>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  <ChevronsUpDown className="h-4 w-4" />
                  <span className="sr-only">Toggle</span>
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="space-y-2 flex flex-col">
              {currentRequest.attachments.map(a => {
                return <InlineFileViewer fileKey={a} domain={domain} key={a} />
              })}
            </CollapsibleContent>
          </Collapsible> : null}

          {currentRequest.type === 'text' && (
            <div className="space-y-2">
              <Label htmlFor="text-input">Enter text:</Label>
              <Textarea
                required
                id="response"
                name="response"
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

// take picture hay que arreglarlo de nuevo: IN PROGRESS
// quiero poder mandar archivos como additional requests: DONE
// cuando envíe el contrato, quiero que se pueda descargar, revisar y firmar en la UI sin necesidad de ir al correo: DONE
// quiero poder personalizar cada correo del sistema: IN PROGRESS
// el formulario no carga y muestra la info

/*
Hey Carlos

Here’s a quick overview of the application, its technical specifications, and features:

Technical Specifications:
- Frontend: Built in Angular v18.
- Backend: Utilizes PostgreSQL as the database and queries through APIs using React and PostgREST.
- Deployment: Application and database are available via Microsoft Azure for cloud hosting.

Application Features
 - Workflow: Basic workflow management. Allowing for automation in data entry and process management. Allows for individual and group task assignments. 
 - Reporting: In-built configurable reporting tools for creating basic reports.
 - User Management: Comprehensive user management capabilities.
 - Customization: Users can customize table views, dashboards, and landing screens using a combination of reports and tables.
Security Measures
 - Session Security: Tokenized session logins with expiration periods to enhance security.
 - Password Management: User-created passwords are encrypted and stored securely, adhering to HTTPS standards for password encryption. (No original passwords stored on system)
*/