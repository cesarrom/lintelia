import { SignatureMaker } from '@docuseal/signature-maker-react'

import { Label } from "@/components/ui/label";
import { StepProps } from "../stepProps";
import { Button } from "@/components/ui/button";
import { useEffect, useState, useTransition } from "react";
import { GetTenant, getTenant } from "@/actions/tenants";
import { useUser } from "@descope/nextjs-sdk/client";
import { getValidationFeatureResponse, registerValidationFeatureResponse } from "@/actions/applications";
import { getUser } from "@/actions/users";
import { uploadFile, downloadFile } from "@/actions/files";
import { getActiveFormByPurpose } from '@/actions/forms';
import { RiskAssessmentWizardStep } from '@/components/RiskAssessmentWizard';
import { FileViewer, InlineFileViewer } from '@/app/(app)/app/applications/reviews/FileViewer/FileViewer';

export const Feature = 'Signature';

export const Create = (props: StepProps & { readOnly?: boolean }) => {
  const [signature, setSignature] = useState<string | null>(null);
  const [user, setUser] = useState<null | ReturnType<typeof useUser>['user']>(null);
  const [sending, startTransition] = useTransition();
  const [tenant, setTenant] = useState<null | GetTenant>(null);
  const [contractUrl, setContractUrl] = useState<string | null>(null);
  const grayPlaceholderImageUrl = 'https://craftypixels.com/placeholder-image/400x200/b0b0b0/fff&text=+';

  useEffect(() => {
    startTransition(async () => {
      setUser(await getUser());
      const tenant = await getTenant();
      const form = await getActiveFormByPurpose(tenant.domain, props.purpose);
      setContractUrl(form.contractKey);
      setTenant(tenant);
    });
  }, []);

  useEffect(() => {
    if (!tenant || !props.readOnly) {
      return;
    }

    startTransition(async () => {
      const response = await getValidationFeatureResponse(
        tenant.domain,
        props.applicationId,
        Feature
      );
      const data = JSON.parse(response.data);

      const signatureData = await downloadFile(tenant.domain, data.signatureKey);
      setSignature(signatureData.Body);
    });
  }, [props.readOnly, tenant])

  return (
    <>
      <div className="space-y-4">
        <Label>Terms Review and Digital Signature</Label>
        {contractUrl && (
          <div className="border rounded-lg p-4 bg-white">
            <InlineFileViewer fileKey={contractUrl} domain={tenant.domain} />
          </div>
        )}
        <div className="border rounded-lg p-4 bg-white">
          {props.readOnly ? (
            <img
              src={!sending && signature ? signature : grayPlaceholderImageUrl}
              alt="Signature"
              className={`max-w-md ${sending ? 'animate-pulse' : ''}`}
            />
          ) : (
            <>

              <p className="text-sm text-gray-600 mb-4">
                By providing a digital signature below, I acknowledge that I have read, understood, and agree to the terms and conditions presented above. I understand that this digital signature constitutes a legally binding acceptance of these terms.
              </p>


              <SignatureMaker
                withSubmit
                withUpload={false}
                onChange={(event) => setSignature(event.base64)}
                onSave={() => {
                  startTransition(async () => {
                    const signatureKey = await uploadFile(
                      tenant.domain,
                      signature,
                      `${user.userId}__signature`
                    );

                    const data = { signatureKey };
                    await registerValidationFeatureResponse(
                      tenant.domain,
                      props.applicationId,
                      Feature,
                      data
                    );

                    props.onDone(props.currentStep);
                  });
                }}
              />
            </>
          )}
        </div>
      </div>
    </>
  );
};

export const Review = (props: StepProps) => <Create {...props} readOnly />;