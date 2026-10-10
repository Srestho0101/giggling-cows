import { ModulePage } from "@/components/module-page";
import { MilkSalesWorkspace } from "@/components/operational-pages";

export default function MilkSalesPage() {
  return <ModulePage title="Milk and Sales" subtitle="Record milk output, manage customers, and follow invoices."><MilkSalesWorkspace /></ModulePage>;
}
