import { AppShell } from "@/components/app-shell";
import { WorkspaceDateProvider } from "@/components/workspace-date";

export default function WorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <WorkspaceDateProvider>
      <AppShell>{children}</AppShell>
    </WorkspaceDateProvider>
  );
}
