'use client'

import { useState, useTransition } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import FormViewer from '../FormViewer/FormViewer'
import KYC from '../KYC/KYC'
import { CreatedApplication, registerFormAnswers } from '@/actions/applications/registerFormAnswers'
import { useSession } from '@/providers/session/session.provider'

export default function Wizard({ form }: { form: any }) {
  const { session } = useSession();

  console.log({ session });

  const [step, setStep] = useState(1)
  const [_, startTransition] = useTransition();
  const [application, setApplication] = useState<CreatedApplication | null>(null);

  const handleNext = () => {
    setStep(prev => Math.min(prev + 1, 2))
  }

  const handlePrev = () => {
    setStep(prev => Math.max(prev - 1, 1))
  }

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <>
            <CardHeader>
              <CardTitle className="text-2xl sm:text-3xl md:text-4xl">Bank Registration</CardTitle>
              <CardDescription className="text-lg sm:text-xl">Please fill in your personal information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormViewer form={form} data={application?.data} disabled={!!application?.verificationWorkflowRunId} onSave={data => startTransition(async () => {
                const application = await registerFormAnswers(session.tenant.domain, session.user.id, form.id, data);
                setApplication(application);
              })} />
            </CardContent>
          </>
        )
      case 2:
        return (
          <>
            <CardHeader>
              <CardTitle className="text-2xl sm:text-3xl md:text-4xl">KYC Process</CardTitle>
              <CardDescription className="text-lg sm:text-xl">Verify your identity</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <KYC workflowRunId={application?.verificationWorkflowRunId || ''} />
            </CardContent>
          </>
        )
    }
  }

  return (
    <Card className="w-full mx-auto bg-background">
      <div className="p-6 sm:p-8">
        <div className="flex justify-between mb-6 sm:mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`w-1/4 h-3 sm:h-4 rounded-full ${i <= step ? 'bg-primary' : 'bg-secondary'
                }`}
            />
          ))}
        </div>
      </div>
      {renderStep()}
      <CardFooter className="flex flex-col sm:flex-row justify-between p-6 sm:p-8 space-y-4 sm:space-y-0">
        {step > 1 && step < 4 && (
          <Button variant="outline" onClick={handlePrev} className="w-full sm:w-auto">
            Previous
          </Button>
        )}
        {step < 4 && (
          <Button onClick={handleNext} className="w-full sm:w-auto sm:ml-auto">
            {step === 3 ? 'Submit' : 'Next'}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}