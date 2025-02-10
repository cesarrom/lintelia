import { getTenant } from '@/actions/tenants';
import { SignOn } from '@/components/SignOn';

export default async function SignOnPage() {
    const tenant = await getTenant();
  
  return (
    <SignOn domain={tenant?.domain} />
  );
}