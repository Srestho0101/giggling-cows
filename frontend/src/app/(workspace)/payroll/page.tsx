import { ModulePage } from "@/components/module-page";
import { PayrollWorkspace } from "@/components/operational-pages";

export default function PayrollPage() {
  return <ModulePage title="Payroll" subtitle="Manage workers, attendance, salary settlements, and substitute costs."><PayrollWorkspace /></ModulePage>;
}
