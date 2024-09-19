import { getSession } from "@/actions/session/getSession";
import { getCurrentForm } from "@/actions/tenants/getForm";
import { FORM_PURPOSES } from "@fintivio-sst/core/enums";
import dynamic from 'next/dynamic';

const Wizard = dynamic(() => import('./Wizard/Wizard'), {
  ssr: false,
});

export default async function ClientOnboardingPage() {
  const session = await getSession();
  const form = await getCurrentForm(session.tenant.domain, FORM_PURPOSES.clientOnboarding);

  // TODO: migrate to https://www.docuseal.co/nextjs-document-signing#

  // form data from the form related for the organization
  //   TODO: product type / ex: checking account (the process to actually give the person this product, is outside of our scope)
  //  - country, income volume, transaction volume: (the risk parameters will have default values, but the user can change them)

  // -- additional information --
  // - name of the 3rd child => "name_of_the_3rd_child": "juan"
  // - certificate for 3rd child (file) => "certificate_for_3rd_child": "https://example.com/certificate.pdf"
  // ----------------------------

  // risk analysis: true | false
  // face validation: true | false
  // ID validation: true | false (this included passport, driver's license, etc) (we need to track expiration date for these kind of documents)
  // document validation: true | false (the user can define how often they ask for these documents again)
  // TODO: Voice validation: true | false

  // accepted / rejected


  // example: 
  // I want to open an account for Galicia, after I filled the form,
  // my boss must be able to see the application, modify it, and sign it.

  // this means that other users can re-visit the application before submitting it, and modify it / sign it
  // for certain roles, like "Owner", the signature and information for all owners is needed. It is not necessarily limited to just owner

  return <div className="flex h-full w-full">
    <Wizard form={JSON.parse(form.schema).form} />
  </div>
}