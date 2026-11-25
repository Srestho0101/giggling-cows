import { ModulePage } from "@/components/module-page";
import { TodaySubtitle, TodayWorkspace } from "@/components/planned-pages";

export default function TodayPage() {
  return <ModulePage title="Today" subtitle={<TodaySubtitle />}><TodayWorkspace /></ModulePage>;
}
