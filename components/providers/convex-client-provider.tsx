"use client";

import { ConvexReactClient } from "convex/react";
import { ConvexProvider } from "convex/react";
import { useMemo } from "react";

type Props = {
  children: React.ReactNode;
};

export function ConvexClientProvider({ children }: Props) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  const client = useMemo(() => {
    if (!convexUrl) {
      throw new Error("NEXT_PUBLIC_CONVEX_URL nao definido.");
    }
    return new ConvexReactClient(convexUrl);
  }, [convexUrl]);

  return (
    <ConvexProvider client={client}>{children}</ConvexProvider>
  );
}
