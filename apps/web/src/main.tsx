import "./globals.css";
import React, { Suspense } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { router } from "./app/router";
import { Providers } from "./lib/providers/providers";

const el = document.getElementById("root");
if (el) {
  const root = createRoot(el);
  root.render(
    <React.StrictMode>
      <Providers>
        <RouterProvider router={router} />
      </Providers>
    </React.StrictMode>
  );
} else {
  throw new Error("Could not find root element");
}
