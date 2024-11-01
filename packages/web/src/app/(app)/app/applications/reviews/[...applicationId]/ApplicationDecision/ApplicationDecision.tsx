'use client';
import { Application } from "@/actions/applications";
import { updateApplicationStatus } from "@/actions/applications";
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import React from "react";
import { SendContractButton } from "../SendContract/SendContract";

export const ApplicationDecision = ({ application, domain }: { application: Application; domain: string }) => {
  const [_, startTransition] = React.useTransition();
  const [status, setStatus] = React.useState(application.status);
  React.useEffect(() => {
    setStatus(application.status);
  }, [application]);

  const isPending = status === 'pending';
  const [isWaitingForContract, setIsWaitingForContract] = React.useState(status === 'contract-sent');
  const contractSigned = status === 'contract-signed';

  const handleDecision = React.useCallback((status: 'approved' | 'rejected') => {
    startTransition(async () => {
      setStatus(status)
      await updateApplicationStatus(domain, application.id, status);
      window.location.reload();
    });
  }, [application]);


  return <Card>
    <CardHeader>
      <CardTitle>Application Decision</CardTitle>
    </CardHeader>
    <CardContent>
      {!isPending && !isWaitingForContract && !contractSigned ?
        (
          <div className="text-center">
            This application has been {status}.
          </div>
        ) :
        (
          <>
            {isWaitingForContract ? <div className="text-center">
              Waiting for user to upload the signed contract.
            </div> : null}
            {contractSigned ? <div className="text-center">
              Remember to review the contract before approving the application.
            </div> : null}
            <div className="flex justify-between">
              <Button variant="destructive" onClick={() => handleDecision('rejected')}>
                Reject Application
              </Button>
              {isPending ?
                <>{
                  isWaitingForContract ? null : <SendContractButton onDone={() => { setIsWaitingForContract(true) }} applicationId={application.id} domain={domain} />
                }</> :
                contractSigned ?
                  <Button variant="default" onClick={() => handleDecision('approved')}>
                    Approve Application
                  </Button>
                  :
                  null
              }
            </div>
          </>
        )}
    </CardContent>
  </Card>
}