'use client';

import { Descope } from '@descope/nextjs-sdk';
import React, { useState } from 'react';
import Cookie from 'js-cookie';
import { getTenant } from '@/actions/tenants';
import { matchInvitationRoles } from '@/actions/users';
import { Card, CardContent } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
Tabs

const AnyDescope = Descope as any;

export function SignOn({ domain }: { domain?: string }) {
  const [_, startTransition] = React.useTransition();
  const [activeTab, setActiveTab] = useState('users')

  const Login = <AnyDescope
    flowId="passwords-with-explicit-sign-up"
    redirectAfterSuccess="/onboarding"
    onSuccess={data => {
      startTransition(async () => {
        const isLocal = window.location.hostname.includes('local.fintivio.org');
        let redirectUri = '/onboarding';

        try {
          const tenant = await getTenant();
          redirectUri = await matchInvitationRoles(data.detail.user?.userId, tenant.domain);
        } catch (e) {
          console.error(e);
        }

        if (isLocal) {
          // we set the JWT as a cookie called DS
          Cookie.set('DS', data.detail.sessionJwt);
        }

        window.location.href = redirectUri;
      })
    }}
  />

  if (!domain) {
    return Login;
  }

  return (
    <Card className="w-full max-w-3xl">
      <CardContent className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="users">Clients</TabsTrigger>
            <TabsTrigger value="admins">Personnel</TabsTrigger>
          </TabsList>
          <TabsContent value="users">
            {Login}
          </TabsContent>
          <TabsContent value="admins">
            {Login}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}