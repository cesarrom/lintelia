import { CameraIcon, Upload, X } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useState, useRef, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"

interface PhotoUploadProps {
  onChange?: (file: File | null, value?: string) => void
  onBlur?: () => void
  value?: string | null
  name?: string
  accept?: string
  required?: boolean
  title?: string
  disabled?: boolean
  initialFile?: File | null
}

export function PhotoField({
  onChange,
  onBlur,
  value,
  name = 'photo',
  accept = 'image/*',
  required = false,
  title,
  initialFile,
  disabled = false,
}: PhotoUploadProps = {}) {
  const [preview, setPreview] = useState<string | null>(value || null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setPreview(value || null);
  }, [value])



  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null
    handleImageSelection(file)
  }

  const handleImageSelection = useCallback(async (file: File | null) => {
    if (file) {
      const base64Value = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          resolve(reader.result as string)
        }
        reader.readAsDataURL(file)
      });
      onChange?.(file, base64Value);
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    } else {
      setPreview(null);
      onChange?.(null);
    }
  }, [onChange])

  useEffect(() => {
    if (initialFile) {
      handleImageSelection(initialFile)
    }
  }, [handleImageSelection, initialFile]);

  const activateCamera = async () => {
    try {
      setError(null)
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        setIsCameraActive(true)
      } else {
        console.error('Video ref is null')
        setError('Failed to initialize video element')
      }
    } catch (err) {
      console.error("Error accessing the camera", err)
      setError('Failed to access the camera')
    }

    return;

  }

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas')
      canvas.width = videoRef.current.videoWidth
      canvas.height = videoRef.current.videoHeight
      canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0)
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], "captured_image.jpg", { type: "image/jpeg" })
          handleImageSelection(file)
        }
      }, 'image/jpeg')
    }
    stopCamera()
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      setIsCameraActive(false)
    }
  }

  const removePhoto = () => {
    setPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onChange?.(null)
  }

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  return (
    <div className="space-y-4">
      <Label htmlFor={name}>{title || 'Upload Photo'}</Label>
      <div className="flex items-center space-x-4">
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          <span className="sr-only">{title || 'Upload Photo'}</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled}
          onClick={isCameraActive ? capturePhoto : activateCamera}
        >
          <CameraIcon className="h-4 w-4" />
          <span className="sr-only">{isCameraActive ? 'Capture photo' : 'Activate camera'}</span>
        </Button>
        <Input
          type="file"
          id={name}
          name={name}
          accept={accept}
          required={required}
          className="hidden"
          onChange={handleFileChange}
          onBlur={onBlur}
          disabled={disabled}
          ref={fileInputRef}
        />
      </div>
      {error && <p className="text-destructive">{error}</p>}
      <div className={`relative mt-4 bg-muted rounded-lg overflow-hidden ${isCameraActive ? 'block' : 'hidden'}`} style={{ maxWidth: '100%', maxHeight: '400px' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="absolute top-2 right-2"
          disabled={disabled}
          onClick={capturePhoto}
        >
          Capture Photo
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="absolute top-2 left-2"
          disabled={disabled}
          onClick={stopCamera}
        >
          <X className="h-4 w-4 mr-2" />
          Stop Camera
        </Button>
      </div>
      <div className={`relative mt-4 ${preview && !isCameraActive ? 'block' : 'hidden'}`}>
        <div className="max-w-md mx-auto overflow-hidden rounded-lg bg-muted" style={{ maxHeight: '400px' }}>
          <img
            src={preview || ''}
            alt="Preview"
            className="w-full h-full object-cover"
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="absolute top-2 right-2"
          onClick={removePhoto}
          disabled={disabled}
        >
          <X className="h-4 w-4 mr-2" />
          Remove Photo
        </Button>
      </div>
    </div>
  )
}