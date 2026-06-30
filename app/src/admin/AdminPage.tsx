import { DoctorEnrollment } from "./DoctorEnrollment";
import { FraudPatterns } from "./FraudPatterns";
import { PolicyRegistration } from "./PolicyRegistration";
import { EscrowBalance } from "./EscrowBalance";
import { VerifierRegistry } from "./VerifierRegistry";
import { InsurerAudit } from "./InsurerAudit";
import { PageHeader } from "../components/ui/PageHeader";
import { PageColumn, PageContent, PageGrid } from "../components/ui/PageGrid";
import { SectionCard } from "../components/ui/SectionCard";

export function AdminPage() {
  return (
    <PageContent>
      <PageHeader
        title="Admin Panel"
        subtitle="Insurer ASP enrollment, fraud patterns, policy registration, escrow, and selective-disclosure audit."
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
          <SectionCard label="Passport" title="Verifier registry">
            <VerifierRegistry />
          </SectionCard>
          <SectionCard label="Audit" title="Insurer view (selective disclosure)">
            <InsurerAudit />
          </SectionCard>
        </PageColumn>
      </PageGrid>
    </PageContent>
  );
}
