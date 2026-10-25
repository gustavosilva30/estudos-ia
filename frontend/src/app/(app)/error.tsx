"use client";

import { Alert, Button } from "@/components/ui/primitives";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md space-y-4 py-16">
      <h1 className="text-xl font-semibold">Algo deu errado</h1>
      <Alert>Não foi possível exibir esta página. Tente novamente.</Alert>
      <Button onClick={reset}>Tentar novamente</Button>
    </div>
  );
}
