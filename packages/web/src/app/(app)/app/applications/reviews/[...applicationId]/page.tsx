/**
 * v0 by Vercel.
 * @see https://v0.dev/t/3t2OW0rlXGm
 * Documentation: https://v0.dev/docs#integrating-generated-code-into-your-nextjs-app
 */
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { getTenant } from "@/actions/tenants"
import { Application, getApplicants, getApplicationById, getLinkedApplications } from "@/actions/applications"
import { getActiveFormByPurpose, getAvailableValidationFeatures } from "@/actions/forms"
import FormViewer from "@/app/(app)/onboarding/FormViewer/FormViewer"
import AdditionalInfo from "./AdditionalInfo/AditionalInfo"
import { getRiskByApplicationId } from "@/actions/applications"
import { ApplicationDecision } from "./ApplicationDecision/ApplicationDecision"
import dynamic from 'next/dynamic';
import { downloadFileContents } from "@/actions/files"
import { ScrollArea } from "@/components/ui/scroll-area"
import Link from "next/link"
import { User } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Features } from "@/app/(app)/onboarding/[purpose]/features/Features"

const FileViewer = dynamic(() => import("../FileViewer/FileViewer").then(m => m.FileViewer), { ssr: false });

export default async function ApplicationReviewPage({ params }: { params: { applicationId: string[] } }) {
  const [applicationId, userId] = params.applicationId;
  const tenant = await getTenant();
  const applicationRef = await getApplicationById(tenant.domain, Number(applicationId));
  const linkedApplications = await getLinkedApplications(tenant.domain, Number(applicationId));
  const linkedApplicationsByUserId = Object.fromEntries(linkedApplications.map(la => [la.userId, la]));
  const application: Application = userId ? linkedApplications.find(a => a.userId === userId && a.parentApplicationId === applicationRef.id) : applicationRef;
  const applicants = userId ? [] : await getApplicants(tenant.domain, Number(applicationId))

  const [features, form] = await Promise.all([
    getAvailableValidationFeatures(tenant.domain),
    getActiveFormByPurpose(tenant.domain, application.applicationPurpose)
  ]);

  const data = JSON.parse(application.data);

  const risk = await getRiskByApplicationId(
    tenant.domain,
    application.id,
    data
  );

  return (
    <div className="w-full max-w-5xl mx-auto p-6 md:p-8 lg:p-10">
      <div className="grid gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Client Information:</CardTitle>
          </CardHeader>
          <CardContent>
            <h3>Risk: {risk}</h3>
            <Features availableFeatures={features} activeFeatures={form.validationFeatures} review applicationId={application.id} purpose={application.applicationPurpose} />
          </CardContent>
        </Card>
        {applicants.length ? <Card>
          <CardHeader>
            <CardTitle>Linked Users</CardTitle>
            <CardDescription>Users associated with this application</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[300px] rounded-md border p-4">
              {applicants.map((user, index) => (
                <Link key={index} href={`/app/applications/reviews/${applicationId}/${user.userId}`} style={{ pointerEvents: linkedApplicationsByUserId[user.userId] ? 'auto' : 'none' }}>
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4" />
                    <span>{user.name}</span>
                    <Badge variant="secondary">{linkedApplicationsByUserId[user.userId] ? 'applied' : 'pending'}</Badge>
                  </div>
                </Link>
              ))}
            </ScrollArea>
          </CardContent>
        </Card> : null}
        <AdditionalInfo application={application} domain={tenant.domain} additionalRequests={data.additionalRequests || []} />
        <ApplicationDecision application={application} domain={tenant.domain} />
      </div>
    </div>
  )
}