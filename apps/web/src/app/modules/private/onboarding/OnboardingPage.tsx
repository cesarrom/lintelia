import { useNavigate } from "react-router";
import { Wrapper } from "./components/wrapper";
import { useTenant } from "@/lib/providers/TenantProvider";
import { TenantOnboardingPage } from "./components/tenant-onboarding";
import { useEffect } from "react";

export default function OnboardingPage() {
  const { tenant, isLoading } = useTenant();
  const redirect = useNavigate();

  useEffect(() => {
    if (tenant) { void redirect('/app/dashboard') }
  }, [tenant]);

  if (isLoading || tenant) return null;

  return (
    <Wrapper>
      <TenantOnboardingPage />
    </Wrapper>
  );
}