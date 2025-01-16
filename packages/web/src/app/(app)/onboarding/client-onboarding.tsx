'use server'
import { getTenant } from "@/actions/tenants";
import { getApplicationsByUserId } from "@/actions/applications";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { getUser } from "@/actions/users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PlusCircle } from "lucide-react";

export default async function ClientOnboardingPage({ searchParams }: { searchParams: any }) {
  const tenant = await getTenant();
  const s = await getUser();
  const applications = await getApplicationsByUserId(tenant.domain, s.userId, searchParams.parentApplicationId ? Number(searchParams.parentApplicationId) : undefined);


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

  if (!applications.length) {
    return redirect(`/onboarding/new`);
  }

  const additionalRequestsMap = Object.fromEntries(applications.map(({ id, data }) => [id, JSON.parse(data)?.additionalRequests?.filter?.(ar => ar.status === 'pending')?.length || 0]));

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {applications.map((app) => (
        <Card key={app.id}>
          <CardHeader>
            <CardTitle>{app.applicationPurpose} application</CardTitle>
            <CardDescription>{additionalRequestsMap[app.id] ? `${additionalRequestsMap[app.id]} Pending requests` : ''}</CardDescription>
            <CardDescription>Created on {app.createdAt}</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant={app.status === 'Approved' ? 'outline' : app.status === 'Rejected' ? 'destructive' : 'default'}>
              {app.status}
            </Badge>
          </CardContent>
          <CardFooter>
            <Button asChild>
              <Link href={`/onboarding/${app.id}`}>View Details</Link>
            </Button>
          </CardFooter>
        </Card>
      ))}
      <Card>
        <CardHeader>
          <CardTitle>New Application</CardTitle>
          <CardDescription>{''}</CardDescription>
          <CardDescription>{''}</CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant={'default'} className=" opacity-0"></Badge>
        </CardContent>
        <CardFooter>
          <Button asChild>
            <Link href={`/onboarding/new`}>
              <PlusCircle></PlusCircle>
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );

}