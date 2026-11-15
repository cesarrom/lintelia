'use client';

import { Descope } from '@descope/react-sdk';
import React, { useState } from 'react';
import Cookie from 'js-cookie';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// import { afterLogin } from '@/app/(modules)/(public)/(auth)/(actions)/actions';
import { wait } from '@/lib/utils';
import { useTheme } from '@/lib/providers/ThemeProvider';
import { useNavigate } from 'react-router';
import { useAuthAfterLoginMutation } from '@/lib/services/auth.hooks';

export function SignOn({ domain }: { domain?: string }) {
  const [, startTransition] = React.useTransition();
  const [activeTab, setActiveTab] = useState('users')
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { mutateAsync: afterLogin } = useAuthAfterLoginMutation();

  const Login = <Descope
    theme={theme === 'dark' ? 'dark' : 'light'}
    flowId="passwords-with-explicit-sign-up"
    onSuccess={(data: any) => {
      startTransition(async () => {
        const isLocal = window.location.hostname.includes('local.fintivio.org') || window.location.hostname.includes('localhost');

        if (isLocal) {
          // we set the JWT as a cookie called DS
          Cookie.set('DS', data.detail.sessionJwt);
        }

        try {
          const firstSeen = !!data.detail.firstSeen;
          await wait(1000);
          const response = await afterLogin({ firstSeen });
          console.log(response);
          navigate('/app' + response.redirectPath);
        } catch (e) {
          console.error(e);
        }
      })
    }}
  />

  if (!domain) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="max-w-[750px] w-full">
          {Login}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center h-screen">
      <div className="max-w-[750px] w-full">
        <Card className="w-full">
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
      </div>
    </div>
  );
}