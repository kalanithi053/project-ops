"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const WORKSPACE_ROUTES = [
  "/dashboard",
  "/projects",
  "/reports",
  "/users",
  "/teams",
  "/preferences",
  "/settings",
  "/settings/account",
  "/settings/plans",
  "/settings/priorities",
  "/settings/project-types",
  "/settings/roles",
  "/settings/ticket-statuses",
  "/settings/workspace",
] as const;

export function WorkspacePrefetcher({ slug }: { slug: string }) {
  const router = useRouter();

  useEffect(() => {
    if (!slug) return;

    for (const route of WORKSPACE_ROUTES) {
      router.prefetch(`/${slug}${route}`);
    }
  }, [router, slug]);

  return null;
}
