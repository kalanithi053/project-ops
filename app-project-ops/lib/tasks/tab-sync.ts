export function taskBoardSyncKey(
  workspaceSlug: string,
  projectId: string,
): string {
  return `projectops:tasks:${workspaceSlug}:${projectId}`;
}

export function notifyTaskBoard(
  workspaceSlug: string,
  projectId: string,
): void {
  localStorage.setItem(
    taskBoardSyncKey(workspaceSlug, projectId),
    String(Date.now()),
  );
}
