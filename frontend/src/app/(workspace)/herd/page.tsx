import { ModulePage } from "@/components/module-page";
import { HerdWorkspace } from "@/components/operational-pages";

export default function HerdPage() {
  return <ModulePage title="Herd" subtitle="Manage cow records, housing, and weights."><HerdWorkspace /></ModulePage>;
}
