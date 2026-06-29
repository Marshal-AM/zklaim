import { Link } from "react-router-dom";
import { env } from "../config/env";
import { formatUsdc } from "../lib/balances";
import { usePatientStore } from "../store/patientStore";
import { useWalletStore } from "../store/wallet";
import {
  CopyField,
  ProminentCopyCredential,
  truncateMiddle,
} from "../components/ui/CopyField";
import { SectionCard } from "../components/ui/SectionCard";

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IdentityStatusOverview() {
  const identity = usePatientStore((s) => s.identity);

  if (!identity) return null;

  const directoryOk = env.isSupabaseEnabled();
  const metCents = identity.accumulator_met_cents;
  const limitCents = identity.deductible_limit_cents;
  const pct = Math.min(100, Math.round((metCents / limitCents) * 100));
  const met = metCents >= limitCents;
  const remainingCents = Math.max(0, limitCents - metCents);

  return (
    <div className="identity-hero card-padded min-w-0">
      <div className="identity-hero__main">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="section-label">Annual deductible</p>
          <span className={met ? "badge-success" : "badge-primary"}>
            {met ? "Met — 100% covered" : `${pct}% toward threshold`}
          </span>
        </div>
        <p className="mt-1 text-2xl font-[650] tabular-nums tracking-tight">
          {formatUsdc(metCents)}
          <span className="text-base font-normal text-muted-foreground">
            {" "}
            / {formatUsdc(limitCents)}
          </span>
        </p>
        <div
          className="deductible-card__track mt-3"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Annual deductible progress"
        >
          <div
            className={`deductible-card__fill ${met ? "deductible-card__fill--met" : ""}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {met
            ? "You've met your annual deductible. Further covered claims settle at the policy rate."
            : `${formatUsdc(remainingCents)} remaining before your deductible is met. Amounts are tracked privately — individual claims are never listed here.`}
        </p>
      </div>

      <div className="identity-hero__badges">
        <span className="badge-success">Local keys secured</span>
        {directoryOk ? (
          <span className="badge-success">Directory registered</span>
        ) : null}
      </div>
    </div>
  );
}

export function IdentityShareCard() {
  const identity = usePatientStore((s) => s.identity);
  const walletAddress = useWalletStore((s) => s.address);

  if (!identity) return null;

  const stellar = walletAddress ?? identity.stellar_address ?? null;
  const directoryMode = env.isSupabaseEnabled();

  return (
    <SectionCard
      label="For your doctor"
      title="What to share"
      size="fit"
      className="identity-share-card"
    >
      <p className="identity-share-intro">
        {directoryMode
          ? "Your doctor uses this address to send encrypted claims to your inbox."
          : "Share these credentials so your doctor can encrypt a claim for you."}
      </p>

      <div className="identity-share-grid">
        <div className="identity-share-grid__credential">
          {stellar ? (
            <ProminentCopyCredential
              label="Stellar address"
              value={stellar}
              copyLabel="Copy for your doctor"
              contained
            />
          ) : (
            <div className="identity-wallet-prompt identity-wallet-prompt--tile">
              <p className="text-sm font-[650] text-foreground">
                Connect Freighter to show your Stellar address
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Click your address in the header to open the wallet panel.
              </p>
            </div>
          )}
        </div>

        <Link to="/patient/inbox" className="identity-share-cta">
          <span className="identity-share-cta__badge">Next</span>
          <span className="identity-share-cta__content">
            <span className="identity-share-cta__title">
              Open Inbox when your doctor sends a claim
            </span>
            <span className="identity-share-cta__desc">
              Review and submit with zero-knowledge proofs
            </span>
          </span>
          <ChevronRight className="identity-share-cta__icon" />
        </Link>
      </div>

      {directoryMode ? (
        <details className="identity-advanced identity-advanced--compact">
          <summary className="identity-advanced__summary">
            Encryption key (only if directory lookup fails)
          </summary>
          <div className="identity-advanced__body">
            <CopyField
              label="Public encryption key"
              value={identity.box_public_key}
              displayValue={truncateMiddle(identity.box_public_key, 16, 12)}
            />
          </div>
        </details>
      ) : (
        <CopyField
          label="Public encryption key"
          value={identity.box_public_key}
          displayValue={truncateMiddle(identity.box_public_key, 16, 12)}
          hint="Required without the ZKlaim directory."
        />
      )}
    </SectionCard>
  );
}

/** @deprecated Use IdentityShareCard — kept for imports that expect IdentityCard */
export function IdentityCard() {
  return (
    <>
      <IdentityStatusOverview />
      <IdentityShareCard />
    </>
  );
}
