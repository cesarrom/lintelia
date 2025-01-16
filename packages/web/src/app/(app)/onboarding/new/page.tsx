'use server'
import { getTenant } from "@/actions/tenants";
import { listPurposes } from "@/actions/forms";
import { UserTypePicker } from "../UserTypePicker";

export default async function NewApplicationUserPicker({ searchParams }: { searchParams: any }) {
  const tenant = await getTenant();
  const types = await listPurposes(tenant.domain, 'active');

  return <UserTypePicker options={types} />
}