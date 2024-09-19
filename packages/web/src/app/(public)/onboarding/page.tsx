import { getSession } from "@/actions/session/getSession";
import TenantOnboardingPage from "./tenant-onboarding";
import ClientOnboardingPage from "./client-onboarding";
import { redirect } from "next/navigation";

export default async function OnboardingPage() {
  const session = await getSession();

  if (!!session.user?.applications?.length) {
    redirect("/app/dashboard");
  }

  if (!session.tenant) {
    return <TenantOnboardingPage />;
  }

  return <ClientOnboardingPage />;
}