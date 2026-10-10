import { ModulePage } from "@/components/module-page";
import { TodayWorkspace } from "@/components/planned-pages";

export default function TodayPage() {
  return <ModulePage title="Today" subtitle="আজকের খামারের কাজ এবং দৈনিক এন্ট্রি"><TodayWorkspace /></ModulePage>;
}
