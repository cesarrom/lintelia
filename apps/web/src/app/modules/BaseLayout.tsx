import { Suspense } from "react";
import { FullScreenLoader } from '@/components/app/loading';
import { Outlet } from "react-router";


export default function BaseLayout() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <Outlet />
    </Suspense>
  );
}