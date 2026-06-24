import { ProviderHistory } from "./ProviderHistory";
import { SectionCard } from "../components/ui/SectionCard";

export function ProviderHistoryPage() {
  return (
    <SectionCard label="Sent claims" title="Your submission log">
      <ProviderHistory />
    </SectionCard>
  );
}
