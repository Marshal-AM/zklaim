import { hasAdminSigningKey, resolveAdminAddress } from "../lib/adminWallet";
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
  const admin = resolveAdminAddress();
  const signing = hasAdminSigningKey();

  return (
    <PageContent>
      <PageHeader
        title="Admin Panel"
        subtitle={
          signing
            ? `On-chain admin ${admin.slice(0, 8)}… — transactions signed via VITE_DEPLOYER_SECRET_KEY (demo).`
            : `On-chain admin ${admin.slice(0, 8)}… — set VITE_DEPLOYER_SECRET_KEY to sign admin txs.`
        }
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
          <SectionCard label="Passport" title="Verifier whitelist">
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
