import { ModulePage } from "@/components/module-page";
import { MastersWorkspace } from "@/components/planned-pages";

export default function MastersPage() {
  return <ModulePage title="Masters" subtitle="Maintain the shared reference data used throughout the farm"><MastersWorkspace /></ModulePage>;
}
