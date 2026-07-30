import { Lock } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";

/** Shown in place of a settings section's content when the viewer isn't the workspace owner. */
export function OwnerOnlyNotice() {
  return (
    <EmptyState
      icon={Lock}
      title="Owner access required"
      description="Only the workspace owner can view this section."
    />
  );
}
