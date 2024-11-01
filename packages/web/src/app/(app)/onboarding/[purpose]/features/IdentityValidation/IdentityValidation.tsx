import { Label } from "@/components/ui/label";
import { StepProps } from "../stepProps";
import { Input } from "@/components/ui/input";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { CameraIcon, UploadIcon } from "lucide-react";
import { downloadFile, uploadFile } from "@/actions/files";
import { getTenant } from "@/actions/tenants";
import { useUser } from "@descope/nextjs-sdk/client";
import { getValidationFeatureResponse, registerValidationFeatureResponse } from "@/actions/applications";
import { getUser } from "@/actions/users";

const PhotoField = (props: { id: string, title: string, value: string, onChange: (value: string, name: string) => void, disabled?: boolean }) => {
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
        accept="image/*"
        onChange={(e) => handleFileUpload(e)}
        ref={fileInputRef}
        className="hidden"
        disabled={props.disabled}
      />
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
      </div>
    </div>
  );
}

export const Feature = 'Identity Validation';

export const Create = (props: StepProps) => {
  const [idDocument, setIdDocument] = useState<null | { value: string, name: string }>(null);
  const [idBack, setIdBack] = useState<null | { value: string, name: string }>(null);
  const [selfie, setSelfie] = useState<null | { value: string, name: string }>(null);
  const [user, setUser] = useState<null | ReturnType<typeof useUser>['user']>(null);
  const [sending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      setUser(
        await getUser()
      );
    });
  }, []);

  return <>
    <div className="space-y-4">
      <PhotoField id="idDocument" title="Upload ID Document" value={idDocument?.value || ''} onChange={(value: string, name: string) => setIdDocument({ value, name })} disabled={!!sending} />
    </div>
    <div className="space-y-4">
      <PhotoField id="idBack" title="Upload ID Document Back" value={idBack?.value || ''} onChange={(value: string, name: string) => setIdBack({ value, name })} disabled={!!sending} />
    </div>
    <div className="space-y-4">
      <PhotoField id="selfie" title="Take Selfie" value={selfie?.value || ''} onChange={(value: string, name: string) => setSelfie({ value, name })} disabled={!!sending} />
    </div>
    <div className="space-y-4">
      <Button
        onClick={() => {
          startTransition(async () => {
            const tenant = await getTenant();
            const [selfieKey, idKey, idBackKey] = await Promise.all([
              uploadFile(tenant.domain, selfie.value, `${user.userId}__selfie__${selfie.name}`),
              uploadFile(tenant.domain, idDocument.value, `${user.userId}__idDocument__${idDocument.name}`),
              uploadFile(tenant.domain, idBack.value, `${user.userId}__idBack__${idBack.name}`)
            ]);

            const data = { selfieKey, idKey, idBackKey };

            await registerValidationFeatureResponse(tenant.domain, props.applicationId, Feature, data);

            props.onDone();
          });
        }}
        disabled={sending}
      >
        {sending ? 'Sending...' : 'Submit'}
      </Button>
    </div >
  </>
};

export const Review = (props: StepProps) => {
  const [idDocument, setIdDocument] = useState<string>(null);
  const [idBack, setIdBack] = useState<string>(null);
  const [selfie, setSelfie] = useState<string>(null);
  const [sending, startTransition] = useTransition();
  const { user } = useUser();

  useEffect(() => {
    startTransition(async () => {
      const tenant = await getTenant();
      const response = await getValidationFeatureResponse(tenant.domain, props.applicationId, Feature);
      const data = JSON.parse(response.data);

      const [selfieData, idDocumentData, idBackData] = await Promise.all([
        downloadFile(tenant.domain, data.selfieKey),
        downloadFile(tenant.domain, data.idKey),
        downloadFile(tenant.domain, data.idBackKey)
      ]);

      setSelfie(selfieData.Body);
      setIdDocument(idDocumentData.Body);
      setIdBack(idBackData.Body);
    })
  }, [props.applicationId]);

  if (sending) {
    return <div>Loading...</div>
  }

  return <>
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Selfie</h3>
        <img src={selfie} alt="Selfie" className="max-w-md rounded-lg shadow" />
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-2">ID Document Front</h3>
        <img src={idDocument} alt="ID Document Front" className="max-w-md rounded-lg shadow" />
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-2">ID Document Back</h3>
        <img src={idBack} alt="ID Document Back" className="max-w-md rounded-lg shadow" />
      </div>
    </div>
  </>
};