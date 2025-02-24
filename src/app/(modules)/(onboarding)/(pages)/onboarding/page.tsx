import { getTenant } from "@/lib/tenants";
import TenantOnboardingPage from "./tenant-onboarding";
import { redirect } from "next/navigation";
import { Wrapper } from "./wrapper";

export default async function OnboardingPage() {
  const tenant = await getTenant();

  if (!tenant) {
    return <Wrapper>
      <TenantOnboardingPage />
    </Wrapper>;
  }


  redirect('/dashboard');

  return null;
}