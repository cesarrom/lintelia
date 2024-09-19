"use server";

import React from "react";
import { SessionProvider } from "./session.provider";
import { getSession } from "@/actions/session/getSession";

export async function SessionFetcher({ children }: React.PropsWithChildren<unknown>) {
  const session = await getSession();

  return (
    <SessionProvider session={session}>
      {children}
    </SessionProvider>
  );
}