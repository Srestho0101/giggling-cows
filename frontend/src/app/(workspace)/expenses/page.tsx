import { ModulePage } from "@/components/module-page";
import { ExpensesWorkspace } from "@/components/operational-pages";

export default function ExpensesPage() {
  return <ModulePage title="Expenses" subtitle="Review farm spending and record new expenses."><ExpensesWorkspace /></ModulePage>;
}
