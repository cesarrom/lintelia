"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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
// Core viewer
import { Viewer, Worker } from '@react-pdf-viewer/core';

// Plugins
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';

// Import styles
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import { UploadIcon, CameraIcon } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

// Create new plugin instance

export function InlineFileViewer({ fileKey, domain }: { fileKey: string, domain: string }) {
  const defaultLayoutPluginInstance: any = defaultLayoutPlugin();
  const [sending, startTransition] = React.useTransition();
  const [fileContent, setFileContent] = useState<AWSFile | null>(null);

  React.useEffect(() => {
    startTransition(async () => {
      setFileContent(await downloadFile(domain, fileKey))
    });
  }, [fileKey]);

  if (sending) return <div>Loading...</div>

  if (!fileContent) return <div>No content</div>

  const supported = [
    'png',
    'jpeg',
    'jpg',
    'pdf',
  ]

  if (!supported.find(ends => fileKey.endsWith('.' + ends))) {
    return (
      <p>Unsupported file type</p>
    )
  }

  const content = fileKey.endsWith(".png") ||
    fileKey.endsWith(".jpeg") ||
    fileKey.endsWith(".jpg") ? (
    <div className="max-w-md rounded-lg shadow">
      <img
        src={fileContent.Body}
        alt={fileKey}
        style={{ objectFit: "contain" }}
      />
    </div>
  ) : <Worker workerUrl="https://unpkg.com/pdfjs-dist@2.16.105/build/pdf.worker.js">
    <div className="relative h-[600px] w-full">
      <Viewer
        fileUrl={fileContent.Body}
        plugins={[
          defaultLayoutPluginInstance,
        ]} />
    </div>
  </Worker>;

  return <div className="flex flex-col h-full relative">
    {content}
    <Button
      className="absolute bottom-4 right-4"
      onClick={() => window.open(fileContent.Body, '_blank')}
    >
      Download
    </Button>
  </div>
}

export function FileViewer({ fileKeys, domain }: { fileKeys: string[], domain: string }) {
  const [selectedFile, setSelectedFile] = useState<string | null>(fileKeys[0] || null);

  const getDisplayName = (name: string) => {
    const actualName = name.includes('_') ? name.split('_')[1] : name;
    const displayName = actualName.length > 15
      ? `${actualName.slice(0, 7)}...${actualName.slice(-8)}`
      : actualName
    return displayName;
  }

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
              <InlineFileViewer fileKey={selectedFile} domain={domain} />
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function UploadFile(props: { domain: string, id: string, title: string, value: string, onChange: (value: string, name: string) => void, disabled?: boolean, accept?: string }) {
  const [isCameraActive, setIsCameraActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    stopCamera();
  }, [props.disabled]);

  const captureImage = useCallback(() => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas')
      canvas.width = videoRef.current.videoWidth
      canvas.height = videoRef.current.videoHeight
      const context = canvas.getContext('2d')

      if (context) {
        context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
        const blob = canvas.toDataURL('image/jpeg')

        if (blob) {
          props.onChange(blob, props.id + '.jpeg')
        }
        stopCamera()
      }
    }
  }, [props.onChange, videoRef, props.id])

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      const tracks = stream.getTracks()
      tracks.forEach(track => track.stop())
    }
    setIsCameraActive(false)
  }, [videoRef])

  const handleCameraCapture = useCallback(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then((stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream
            videoRef.current.play()
            setIsCameraActive(true)
          }
        })
        .catch((err) => {
          console.error("Error accessing the camera: ", err)
        })
    }
  }, [videoRef])

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        props.onChange(reader.result as string, file.name)
      }
      reader.readAsDataURL(file)
    }
  }, [props.onChange]);

  return (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <Label htmlFor={props.id}>{props.title}</Label>
      <Input
        id={props.id}
        type="file"
        accept={props.accept}
        onChange={(e) => handleFileUpload(e)}
        ref={fileInputRef}
        className="hidden"
        disabled={props.disabled}
      />
      {props.accept.includes('image') ?
        <div className="space-y-4">
          {!isCameraActive ? (
            <div className="flex items-center space-x-4">
              {props.value && (
                <img src={props.value} alt={props.title} className="w-24 h-24 object-cover rounded" />
              )}
              <div className="flex space-x-2">
                <Button onClick={() => fileInputRef.current?.click()} disabled={props.disabled}>
                  <UploadIcon className="mr-2 h-4 w-4" /> Upload
                </Button>
                <Button onClick={() => handleCameraCapture()} disabled={props.disabled}>
                  <CameraIcon className="mr-2 h-4 w-4" /> Take Photo
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <video ref={videoRef} className="w-full h-auto" autoPlay playsInline />
              <div className="flex space-x-2">
                <Button onClick={() => captureImage()} disabled={props.disabled}>Capture</Button>
                <Button onClick={stopCamera} variant="outline" disabled={props.disabled}>Cancel</Button>
              </div>
            </div>
          )}
        </div> :
        <>No preview</>}
    </div>
  );
};