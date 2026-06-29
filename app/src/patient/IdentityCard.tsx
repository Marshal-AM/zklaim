import { env } from "../config/env";
import { usePatientStore } from "../store/patientStore";
import { useWalletStore } from "../store/wallet";
import { SectionCard } from "../components/ui/SectionCard";

export function IdentityCard() {
  const identity = usePatientStore((s) => s.identity);
  const address = useWalletStore((s) => s.address);
  if (!identity) return null;

  async function copyKey() {
    if (!identity) return;
    await navigator.clipboard.writeText(identity.box_public_key);
  }

  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
  }

  return (
    <SectionCard label="Your identity" title="Share with your doctor">
      {env.isSupabaseEnabled() ? (
        <p className="text-sm text-muted-foreground">
          You are registered in the ZKlaim directory. Doctors can send claims
          using only your Stellar address — no need to share your encryption key
          manually.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Share your public encryption key with your doctor so they can send you
          claims.
        </p>
      )}
      {address ? (
        <div className="space-y-2">
          <p className="section-label">Stellar address</p>
          <code className="surface-row block p-3 text-safe-mono text-xs">
            {address}
          </code>
          <button
            type="button"
            onClick={copyAddress}
            className="btn-outline-primary text-xs"
          >
            Copy Stellar address
          </button>
        </div>
      ) : identity.stellar_address ? (
        <div className="space-y-2">
          <p className="section-label">Stellar address</p>
          <code className="surface-row block p-3 text-safe-mono text-xs">
            {identity.stellar_address}
          </code>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Connect Freighter to show your Stellar address for doctors.
        </p>
      )}
      <div className="space-y-2">
        <p className="section-label">Public encryption key</p>
        <code className="surface-row block break-all p-3 font-mono text-xs">
          {identity.box_public_key.slice(0, 48)}…
        </code>
        <button
          type="button"
          onClick={copyKey}
          className="btn-outline-primary text-xs"
        >
          Copy public encryption key
        </button>
      </div>
    </SectionCard>
  );
}
