'use client'
import { ValidationFeature } from "@/actions/forms";
import { useEffect, useState, useTransition } from 'react'
import { Button } from "@/components/ui/button"
import React from 'react'
import * as Form from "./Form/Form";
import * as IdentityValidation from "./IdentityValidation/IdentityValidation";
import * as LinkPersons from "./LinkPersons/LinkPersons";
import * as ProofOFLife from "./ProofOfLife/ProofOfLife";
import * as Signature from "./Signature/Signature";
import { StepProps } from "./stepProps";
import { listApplicationValidationFeatures, updateApplicationStatus } from "@/actions/applications";
import { getTenant } from "@/actions/tenants";

const FEATURES = [
  IdentityValidation,
  ProofOFLife,
  LinkPersons,
  Signature,
]

export const Features = ({ availableFeatures, activeFeatures, review, applicationId: appId, purpose }: { availableFeatures: ValidationFeature[], activeFeatures: string[], review?: boolean; applicationId?: number, purpose: string }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const filteredAvailableFeatures = availableFeatures.filter(feature => activeFeatures.includes(feature.id));
  const [applicationId, setApplicationId] = useState(appId || 0);
  const [sending, startTransition] = useTransition();
  const [_, startFeaturesTransition] = useTransition();
  const [applicationFeatures, setApplicationFeatures] = useState<Awaited<ReturnType<typeof listApplicationValidationFeatures>>>([]);

  React.useEffect(() => {
    setApplicationId(appId);
  }, [appId])

  useEffect(() => {
    startFeaturesTransition(async () => {
      const tenant = await getTenant();
      const features = await listApplicationValidationFeatures(tenant.domain, appId);
      setApplicationFeatures(features);
    });
  }, [appId]);

  const comps = [
    Form,
    ...FEATURES.filter(feature => filteredAvailableFeatures.find(f => feature.Feature === f.id)),
  ];

  

  const Review = (props: StepProps) => {
    return <>
      {comps.filter(c => !review ? true : (c.Feature !== 'Link Persons' && (!appId || !!applicationFeatures.find(f => f.featureId === c.Feature)))).map(({ Feature: id, Review: Component }, index) => (
        <div key={id}>
          {
            <Component {...props} />
          }
        </div>
      ))}
      {!review && <Button disabled={sending} onClick={() => {
        startTransition(async () => {
          const tenant = await getTenant();
          await updateApplicationStatus(tenant.domain, props.applicationId, 'pending');
          window.location.reload();
        });
      }} >Looks good!</Button>}
    </>
  }

  const availableComponents = React.useMemo(() => [
    ...comps,
    {
      Feature: 'Review',
      Create: Review,
      Review,
    }
  ], [currentStep, applicationFeatures]);

  useEffect(() => {
    if (review) {
      setCurrentStep(availableComponents.length - 1);
    }
  }, [review, availableComponents]);

  const { Feature: id, Create: Component } = review ? availableComponents[availableComponents.length - 1] : availableComponents[currentStep];

  const Container = React.useCallback(({ children }: React.PropsWithChildren) => {
    return currentStep === 0 || review ? <>{children}</> : <div className="min-h-screen w-full flex flex-col bg-white md:bg-gray-100 md:items-center md:justify-center md:p-4">
      <div className="w-full h-full md:max-w-2xl flex flex-col md:bg-white md:shadow-lg md:rounded-lg md:overflow-hidden relative">
        <div className="bg-indigo-600 px-4 py-4 sm:px-6 sm:py-4">
          <h1 className="text-xl sm:text-2xl font-bold text-white">Banking Application</h1>
          <p className="mt-1 text-sm sm:text-base text-indigo-200">Please fill out the following form.</p>
        </div>
        <div className={`flex-grow flex flex-col p-4 sm:p-6 `}>
          {children}
        </div>
      </div>
    </div>
  }, [currentStep, review]);

  return (
    <Container>
      <Component
        applicationId={applicationId}
        purpose={purpose}
        currentStep={currentStep}
        onApplicationCreated={(applicationId: number) => {
          setApplicationId(applicationId);
        }}
        onDone={() => {
          setCurrentStep(currentStep + 1);
        }}
      />
    </Container>
  );

}