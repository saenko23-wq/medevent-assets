import { WorkspaceView } from "@/app/workspace/workspace-view";

export const dynamic = "force-dynamic";

export default function ProjectWorkspace() {
  return <WorkspaceView type="project" />;
}
