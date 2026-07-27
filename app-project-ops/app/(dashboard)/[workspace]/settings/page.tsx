import { redirect } from "next/navigation";

import { DEFAULT_SETTINGS_SEGMENT } from "@/components/settings/settings-nav";

/**
 * /settings has no content of its own — it forwards to the first section so
 * the rail always has an active item.
 */
export default async function SettingsIndexPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  redirect(`/${workspace}/settings/${DEFAULT_SETTINGS_SEGMENT}`);
}
