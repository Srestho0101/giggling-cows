import { ModulePage } from "@/components/module-page";
import { HealthWorkspace } from "@/components/operational-pages";

export default function HealthPage() {
  return <ModulePage title="Health" subtitle="Keep treatment records and follow upcoming care dates."><HealthWorkspace /></ModulePage>;
}
