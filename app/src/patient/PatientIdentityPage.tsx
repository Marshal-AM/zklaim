import { OnboardingPanel } from "./OnboardingPanel";
import {
  IdentityShareCard,
  IdentityStatusOverview,
} from "./IdentityCard";
import { usePatientStore } from "../store/patientStore";
import { useWalletStore } from "../store/wallet";
import { PageGrid, PageColumn } from "../components/ui/PageGrid";
import { SectionCard } from "../components/ui/SectionCard";

function HowItWorksCard() {
  const steps = [
    {
      n: "1",
      title: "Create your identity",
      desc: "Connect Freighter and generate encryption keys stored only on this device.",
    },
    {
      n: "2",
      title: "Share with your doctor",
      desc: "Give them your Stellar address so they can send encrypted claims.",
    },
    {
      n: "3",
      title: "Submit privately",
      desc: "Review claims in your inbox and settle with zero-knowledge proofs.",
    },
  ] as const;

  return (
    <SectionCard label="How it works" title="Private claims in three steps">
      <ol className="identity-steps">
        {steps.map((step) => (
          <li key={step.n} className="identity-step">
            <span className="identity-step__num">{step.n}</span>
            <div className="min-w-0">
              <p className="font-[650] text-foreground">{step.title}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{step.desc}</p>
            </div>
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}

export function PatientIdentityPage() {
  const identity = usePatientStore((s) => s.identity);
  const walletAddress = useWalletStore((s) => s.address);

  if (!walletAddress) {
    return (
      <SectionCard label="Wallet" title="Connect your patient wallet">
        <p className="text-sm text-muted-foreground">
          Connect Freighter to create or load an identity for this account. Each
          wallet has its own encryption keys, inbox, history, and passport.
        </p>
      </SectionCard>
    );
  }

  if (!identity) {
    return (
      <PageGrid>
        <OnboardingPanel />
        <HowItWorksCard />
      </PageGrid>
    );
  }

  return (
    <PageColumn className="mx-auto max-w-2xl items-center">
      <IdentityStatusOverview />
      <div className="flex w-full justify-center">
        <IdentityShareCard />
      </div>
    </PageColumn>
  );
}
