"use client";

import { useParams } from "next/navigation";

import { IncidentEditor } from "@/components/projects/incident-editor";

export default function NewIncidentPage() {
  const { workspace, projectId } = useParams<{ workspace: string; projectId: string }>();
  return <IncidentEditor workspaceSlug={workspace} projectId={projectId} />;
}
