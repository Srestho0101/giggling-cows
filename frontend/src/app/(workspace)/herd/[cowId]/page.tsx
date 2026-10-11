"use client";

import { useParams } from "next/navigation";
import { CowProfileWorkspace } from "@/components/workspaces/cow-profile-workspace";

export default function CowDetailPage() {
  const params = useParams<{ cowId: string }>();
  const cowTag = decodeURIComponent(params.cowId);

  return <CowProfileWorkspace cowTag={cowTag} />;
}
