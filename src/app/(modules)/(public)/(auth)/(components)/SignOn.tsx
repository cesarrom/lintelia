'use client';

import { Descope } from '@descope/nextjs-sdk';
import React, { useState } from 'react';
import Cookie from 'js-cookie';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { afterLogin } from '@/app/(modules)/(public)/(auth)/(actions)/actions';

export function SignOn({ domain }: { domain?: string }) {
  const [, startTransition] = React.useTransition();
  const [activeTab, setActiveTab] = useState('users')

  const Login = <Descope
    flowId="passwords-with-explicit-sign-up"
    onSuccess={data => {
      startTransition(async () => {
        const isLocal = window.location.hostname.includes('local.fintivio.org');

        if (isLocal) {
          // we set the JWT as a cookie called DS
          Cookie.set('DS', data.detail.sessionJwt);
        }

        try {
          const firstSeen = !!data.detail.firstSeen;
          await afterLogin(firstSeen);
        } catch (e) {
          console.error(e);
        }
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