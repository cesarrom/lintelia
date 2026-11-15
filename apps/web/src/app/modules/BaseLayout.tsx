import { Suspense } from "react";
import { Outlet } from "react-router";


export default function BaseLayout() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Outlet />
    </Suspense>
  );
}