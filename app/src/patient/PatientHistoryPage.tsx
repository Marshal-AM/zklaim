import { ClaimHistory } from "./ClaimHistory";
import { SectionCard } from "../components/ui/SectionCard";

export function PatientHistoryPage() {
  return (
    <SectionCard label="Settled claims" title="On-chain settlement record">
      <ClaimHistory />
    </SectionCard>
  );
}
