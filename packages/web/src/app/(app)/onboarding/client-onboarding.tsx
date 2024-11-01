import { getTenant } from "@/actions/tenants";
import { session } from "@descope/nextjs-sdk/server";
import { getApplicationsByUserId } from "@/actions/applications";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ClipboardCheck } from "lucide-react";
import AdditionalResponses from "./AdditionalResponses/AdditionalResponses";
import { listPurposes } from "@/actions/forms";
import { UserTypePicker } from "./UserTypePicker";

export default async function ClientOnboardingPage({ searchParams }: { searchParams: any }) {
  const tenant = await getTenant();
  const types = await listPurposes(tenant.domain, 'active');
  const s = session();
  const [application] = await getApplicationsByUserId(tenant.domain, s.token.sub!, searchParams.parentApplicationId ? Number(searchParams.parentApplicationId) : undefined);


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

  if (application) {
  const data = JSON.parse(application.data);
  return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <ClipboardCheck className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Application Under Review</CardTitle>
          <CardDescription>Thank you for your submission</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground">
            We've received your application and our team is carefully reviewing it. This process typically takes 3-5 business days.
          </p>
        </CardContent>
        <AdditionalResponses additionalRequests={(data.additionalRequests || []).filter(ar => ar.status === 'pending')} applicationId={application.id} domain={tenant.domain} />
      </Card>
    );
  }

  return <UserTypePicker options={types} />
}