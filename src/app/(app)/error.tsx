"use client";

import { Button, Notice } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-16">
      <Notice tone="red">
        <div className="font-semibold">Something went wrong</div>
        <div className="mt-1">{error.name === "ForbiddenError" ? error.message : "The page couldn't be loaded. Try again, or contact your administrator."}</div>
      </Notice>
      <Button className="mt-4" onClick={reset}>Try again</Button>
    </div>
  );
}
