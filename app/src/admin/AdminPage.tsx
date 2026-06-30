import { resolveAdminAddress } from "../lib/adminWallet";
import { DoctorEnrollment } from "./DoctorEnrollment";
import { FraudPatterns } from "./FraudPatterns";
import { PolicyRegistration } from "./PolicyRegistration";
import { EscrowBalance } from "./EscrowBalance";
import { InsurerAudit } from "./InsurerAudit";
import { PageHeader } from "../components/ui/PageHeader";
import { PageContent } from "../components/ui/PageGrid";
import { SectionCard } from "../components/ui/SectionCard";

const adminGridCardClass = "flex h-full min-h-[22rem] flex-col";

export function AdminPage() {
  const admin = resolveAdminAddress();

  return (
    <PageContent>
      <PageHeader
        title="Admin Panel"
        subtitle={`On-chain admin ${admin.slice(0, 8)}…`}
      />

      <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
        <SectionCard
          label="Escrow"
          title="USDC reserve"
          className={adminGridCardClass}
        >
          <EscrowBalance />
        </SectionCard>
        <SectionCard
          label="Fraud"
          title="Pattern management"
          className={adminGridCardClass}
        >
          <FraudPatterns />
        </SectionCard>
        <SectionCard
          label="ASP"
          title="Doctor enrollment"
          className={adminGridCardClass}
        >
          <DoctorEnrollment />
        </SectionCard>
        <SectionCard
          label="Policy"
          title="On-chain registration"
          className={adminGridCardClass}
        >
          <PolicyRegistration />
        </SectionCard>
      </div>

      <SectionCard label="Audit" title="Insurer view">
        <InsurerAudit />
      </SectionCard>
    </PageContent>
  );
}
