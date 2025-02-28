import TenantOnboardingPage from "./tenant-onboarding";
import { redirect } from "next/navigation";
import { Wrapper } from "./wrapper";
import { getTenant } from "@/app/(modules)/(private)/(profile)/(pages)/settings/actions";

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