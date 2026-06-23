import { DoctorEnrollment } from "./DoctorEnrollment";
import { FraudPatterns } from "./FraudPatterns";
import { PolicyRegistration } from "./PolicyRegistration";
import { EscrowBalance } from "./EscrowBalance";
import { PageHeader } from "../components/ui/PageHeader";
import { PageColumn, PageContent, PageGrid } from "../components/ui/PageGrid";
import { SectionCard } from "../components/ui/SectionCard";

export function AdminPage() {
  return (
    <PageContent>
      <PageHeader
        title="Admin Panel"
        subtitle="Insurer ASP enrollment, fraud patterns, policy registration, and escrow management."
      />

      <PageGrid>
        <PageColumn>
          <SectionCard label="Escrow" title="USDC reserve">
            <EscrowBalance />
          </SectionCard>
          <SectionCard label="ASP" title="Doctor enrollment">
            <DoctorEnrollment />
          </SectionCard>
        </PageColumn>

        <PageColumn>
          <SectionCard label="Fraud" title="Pattern management">
            <FraudPatterns />
          </SectionCard>
          <SectionCard label="Policy" title="On-chain registration">
            <PolicyRegistration />
          </SectionCard>
        </PageColumn>
      </PageGrid>
    </PageContent>
  );
}
