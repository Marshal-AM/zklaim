import { OnboardingPanel } from "./OnboardingPanel";
import { IdentityCard } from "./IdentityCard";
import { DeductibleBar } from "../components/DeductibleBar";
import { usePatientStore } from "../store/patientStore";
import { PageGrid } from "../components/ui/PageGrid";
import { SectionCard } from "../components/ui/SectionCard";

export function PatientIdentityPage() {
  const identity = usePatientStore((s) => s.identity);

  if (!identity) {
    return (
      <PageGrid>
        <OnboardingPanel />
        <SectionCard label="How it works" title="Private claims flow">
          <ol className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-3">
              <span className="badge-primary shrink-0">1</span>
              Connect Freighter and generate your local encryption keys.
            </li>
            <li className="flex gap-3">
              <span className="badge-primary shrink-0">2</span>
              Share your Stellar address with your doctor.
            </li>
            <li className="flex gap-3">
              <span className="badge-primary shrink-0">3</span>
              Receive encrypted claims in your inbox and submit with ZK proofs.
            </li>
          </ol>
        </SectionCard>
      </PageGrid>
    );
  }

  return (
    <PageGrid>
      <IdentityCard />
      <DeductibleBar
        metCents={identity.accumulator_met_cents}
        limitCents={identity.deductible_limit_cents}
      />
    </PageGrid>
  );
}
