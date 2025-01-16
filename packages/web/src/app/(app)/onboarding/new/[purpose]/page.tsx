import { getTenant } from "@/actions/tenants";
import { session } from "@descope/nextjs-sdk/server";
import { getApplicationsByUserId } from "@/actions/applications";
import { Features } from "./features/Features";
import { getActiveFormByPurpose, getAvailableValidationFeatures } from "@/actions/forms";
import { redirect } from "next/navigation";

export default async function ClientOnboardingPage({ params: { purpose }, searchParams }: { params: { purpose: string }, searchParams: any }) {
  const tenant = await getTenant();
  const s = session();

  const [applications, features, form] = await Promise.all([
    getApplicationsByUserId(tenant.domain, s.token.sub!, searchParams.parentApplicationId ? Number(searchParams.parentApplicationId) : undefined),
    getAvailableValidationFeatures(tenant.domain),
    getActiveFormByPurpose(tenant.domain, purpose),
  ]);
  const [p] = [purpose].flat();

  const application = applications.find(application => application.status === 'pending');

  if (application) {
    redirect(`/onboarding?${new URLSearchParams(searchParams).toString()}`);

    return null;
  }

  return <div className="flex h-full w-full">
    <Features availableFeatures={features} activeFeatures={form.validationFeatures} purpose={p} />
  </div>
}