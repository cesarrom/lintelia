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
import { InlineFileViewer, UploadFile } from "@/app/(app)/app/applications/reviews/FileViewer/FileViewer";

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

  if (sending) {
    return <div className={`flex justify-center items-center h-full`}>
      <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500"></div>
    </div>
  }

  return <div className="flex flex-col items-center justify-center p-4">
    <div className="space-y-4">
      <UploadFile domain={null} id="idDocument" title="Upload ID Document" value={idDocument?.value || ''} onChange={(value: string, name: string) => setIdDocument({ value, name })} disabled={!!sending} accept="image/*" />
    </div>
    <div className="space-y-4">
      <UploadFile domain={null} id="idBack" title="Upload ID Document Back" value={idBack?.value || ''} onChange={(value: string, name: string) => setIdBack({ value, name })} disabled={!!sending} accept="image/*" />
    </div>
    <div className="space-y-4">
      <UploadFile domain={null} id="selfie" title="Take Selfie" value={selfie?.value || ''} onChange={(value: string, name: string) => setSelfie({ value, name })} disabled={!!sending} accept="image/*" />
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

            props.onDone(props.currentStep);
          });
        }}
        disabled={sending || !idDocument || !idBack || !selfie}
      >
        {sending ? 'Saving...' : 'Save and Next'}
      </Button>
    </div >
  </div>
};

export const Review = (props: StepProps) => {
  const [idDocument, setIdDocument] = useState<string>(null);
  const [idBack, setIdBack] = useState<string>(null);
  const [selfie, setSelfie] = useState<string>(null);
  const [sending, startTransition] = useTransition();
  const [tenant, setTenant] = useState<Awaited<ReturnType<typeof getTenant>>>(null);

  useEffect(() => {
    startTransition(async () => {
      const tenant = await getTenant();
      setTenant(tenant);
      const response = await getValidationFeatureResponse(tenant.domain, props.applicationId, Feature);
      const data = JSON.parse(response.data);

      setSelfie(data.selfieKey);
      setIdDocument(data.idKey);
      setIdBack(data.idBackKey);
    })
  }, [props.applicationId]);

  if (sending) {
    return <div>Loading...</div>
  }

  return <>
    <div className="flex flex-col gap-4">
      {[selfie, idDocument, idBack].map(url => {
        return <InlineFileViewer key={url} fileKey={url} domain={tenant?.domain} />
      })}
    </div>
  </>
};