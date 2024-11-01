'use client';

import UserType from "@/components/UserType";


export const UserTypePicker = ({ options }: { options: string[] }) => {
  return <UserType userTypes={options.filter(o => o !== 'co-applicant')} onSubmit={type => {
    window.location.href = `/onboarding/${type}`;
  }} />
} 