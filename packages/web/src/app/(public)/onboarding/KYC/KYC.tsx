"use client";

import React, { useRef, useLayoutEffect } from "react";
import { Onfido } from 'onfido-sdk-ui'
import { env } from "@fintivio-sst/core/constants";

export default function KYC({ workflowRunId }: { workflowRunId: string }) {
  const kycContainerRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!kycContainerRef.current) { return; }

    Onfido.environment = 'INSECURE';

    const h = Onfido.init({
      token: env.ONFIDO_TOKEN,
      containerEl: kycContainerRef.current,
      //containerEl: <div id="root" />, an ALTERNATIVE to `containerId`
      onComplete: (data) => {
        console.log('everything is complete', data)
      },
      workflowRunId,
    });

    return () => { h.tearDown() }
  }, [kycContainerRef]);

  return (
    <>

      <div id="onfido-mount" ref={kycContainerRef}></div>
    </>
  );
}