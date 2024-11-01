import TenantOnboardingPage from "./tenant-onboarding";
import ClientOnboardingPage from "./client-onboarding";
import { redirect } from "next/navigation";
import { session } from "@descope/nextjs-sdk/server";
import { getTenant } from "@/actions/tenants";
import { getUserRole } from "@/actions/users";

const Wrapper = ({ children }: React.PropsWithChildren<unknown>) => <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100">
  <main className="w-full max-w-4xl px-4 py-8">
    {children}
  </main>
</div>;

export default async function OnboardingPage({ searchParams }: { searchParams: any }) {
  const user = session();
  const tenant = await getTenant();

  if (!tenant) {
    return <Wrapper>
      <TenantOnboardingPage />
    </Wrapper>;
  }

  const role = await getUserRole(user.token.sub!, tenant.domain);

  if (role?.role === 'admin') {
    redirect('/app/dashboard');
  }

  return <Wrapper>
    <ClientOnboardingPage searchParams={searchParams} />
  </Wrapper>;
}