import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetForm } from "@/components/auth/reset-form";
import { Spinner } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Nova senha" };

export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <ResetForm />
    </Suspense>
  );
}
