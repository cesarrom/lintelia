"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import React from "react"
import { AWSFile, downloadFile } from "@/actions/files"
import { pdfjs, Document } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const base64UrlToUintArray = (data: string): Uint8Array => {
  // Remove padding and replace URL-safe characters
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '')
  
  // Decode base64 to a string
  const binaryString = atob(base64)
  
  // Convert binary string to Uint8Array
  const uint8Array = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    uint8Array[i] = binaryString.charCodeAt(i)
  }
  
  return uint8Array
}

export function FileViewer({ fileKeys, domain }: { fileKeys: string[], domain: string }) {
  const [_, startTransition] = React.useTransition();
  const [fileContent, setFileContent] = useState<AWSFile | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(fileKeys[0] || null);

  React.useEffect(() => {
    if (!selectedFile) return;
    setFileContent(null);

    startTransition(async () => {
      setFileContent(await downloadFile(domain, selectedFile))
    });
  }, [selectedFile]);

  const renderFileContent = () => {
    if (selectedFile.endsWith(".png") ||
      selectedFile.endsWith(".jpeg") ||
      selectedFile.endsWith(".jpg")) {
      return (
        <div className="relative h-[300px] w-full">
          <img
            src={fileContent.Body}
            alt={selectedFile}
            style={{ objectFit: "contain" }}
          />
        </div>
      )
    } else if (selectedFile.endsWith(".pdf")) {
      return (
        <div className="relative h-[300px] w-full">
          <Document file={{ url: fileContent.Body }} renderMode="canvas" />
        </div>
      )
    } else {
      return <p>Unsupported file type</p>
    }
  }
  const getDisplayName = (name: string) => {
    const actualName = name.includes('_') ? name.split('_')[1] : name;
    const displayName = actualName.length > 15
      ? `${actualName.slice(0, 7)}...${actualName.slice(-8)}`
      : actualName
    return displayName;
  }

  const content = React.useMemo(() => fileContent ? renderFileContent() : null, [selectedFile, fileContent]);



  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">View File{fileKeys.length > 1 ? 's' : ''}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[90dvw]">
        <DialogHeader>
          <DialogTitle>File Viewer</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-1 border-r pr-4">
            <h3 className="mb-2 text-sm font-semibold">Files</h3>
            <ul className="space-y-2">
              {fileKeys.map((name) => (
                <li key={name}>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-left"
                    onClick={() => setSelectedFile(name)}
                  >
                    {getDisplayName(name)}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
          <div className="col-span-2">
            <h3 className="mb-2 text-sm font-semibold">File Content: {getDisplayName(selectedFile) || 'None'}</h3>
            <ScrollArea className="h-[90dvh] w-full rounded-md border p-4">
              {content}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}