import { ModulePage } from "@/components/module-page";
import { PurchasesWorkspace } from "@/components/operational-pages";

export default function PurchasesPage() {
  return <ModulePage title="Purchases" subtitle="Evaluate an animal before deciding to buy or return it."><PurchasesWorkspace /></ModulePage>;
}
