'use client'
import { ValidationFeature } from "@/actions/forms";
import { useState, useTransition } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import React from 'react'
import * as Form from "./Form/Form";
import * as IdentityValidation from "./IdentityValidation/IdentityValidation";
import * as LinkPersons from "./LinkPersons/LinkPersons";
import * as ProofOFLife from "./ProofOfLife/ProofOfLife";
import { StepProps } from "./stepProps";
import { updateApplicationStatus } from "@/actions/applications";
import { getTenant } from "@/actions/tenants";
import { useParams } from "next/navigation";

const features = [
  IdentityValidation,
  ProofOFLife,
  LinkPersons,
]

export const Features = ({ availableFeatures, activeFeatures, review, applicationId: appId, purpose }: { availableFeatures: ValidationFeature[], activeFeatures: string[], review?: boolean; applicationId?: number, purpose: string }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const filteredAvailableFeatures = availableFeatures.filter(feature => activeFeatures.includes(feature.id));
  const [applicationId, setApplicationId] = useState(appId || 0);
  const [sending, startTransition] = useTransition();

  React.useEffect(() => {
    setApplicationId(appId);
  }, [appId])

  console.log(filteredAvailableFeatures, activeFeatures, availableFeatures, features);

  const comps = [
    Form,
    ...features.filter(feature => filteredAvailableFeatures.find(f => feature.Feature === f.id)),
  ];

  const Review = (props: StepProps) => {
    return <>
      {comps.filter(c => !review ? true : c.Feature !== 'Link Persons').map(({ Feature: id, Review: Component }, index) => (
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

  if (review) {
    return <Review
      applicationId={applicationId}
      onApplicationCreated={(applicationId: number) => {
        setApplicationId(applicationId);
      }}
      purpose={purpose}
      onDone={() => {
        setCurrentStep(currentStep + 1);
      }}
    />
  }

  const availableComponents = React.useMemo(() => [
    ...comps,
    {
      Feature: 'Review',
      Create: Review,
      Review,
    }
  ], [currentStep]);



  const { Feature: id, Create: Component } = availableComponents[currentStep];

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Onboarding Wizard</CardTitle>
        <CardDescription>Step {currentStep + 1} of {availableComponents.length}: {id}</CardDescription>
      </CardHeader>
      <CardContent>
        <Component
          applicationId={applicationId}
          purpose={purpose}
          onApplicationCreated={(applicationId: number) => {
            setApplicationId(applicationId);
          }}
          onDone={() => {
            setCurrentStep(currentStep + 1);
          }}
        />
      </CardContent>
    </Card>
  );

}