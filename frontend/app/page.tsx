"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import TakeoffsWorkspace from "@/components/TakeoffsWorkspace";

function LoadingFallback() {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-neutral-50">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-bv-blue-400" />
        <p className="text-sm text-neutral-500">Loading Mechanical Takeoffs...</p>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <TakeoffsWorkspace />
    </Suspense>
  );
}
