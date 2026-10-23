import type { SiteProject } from "./types";
import { SitePreview } from "./SitePreview";
import "../../styles/studio.css";

export function PublicSite({ project }: { project: SiteProject }) {
  return <SitePreview project={project} />;
}
