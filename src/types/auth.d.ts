import { useUser } from "@descope/nextjs-sdk/client";

export type User = Awaited<ReturnType<typeof useUser>>['user'];