import { hasAdminSigningKey, resolveAdminAddress } from "../lib/adminWallet";
import { isPassportConfigured } from "../lib/passportContract";

export function VerifierRegistry() {
  const admin = resolveAdminAddress();
  const autoWhitelist = hasAdminSigningKey();

  if (!isPassportConfigured()) {
    return (
      <p className="text-sm text-muted-foreground">
        Set <code className="text-subtle">VITE_PASSPORT_REGISTRY_CONTRACT_ID</code>{" "}
        after deploying passport_registry.
      </p>
    );
  }

  return (
    <div className="space-y-3 text-sm text-muted-foreground">
      <p>
        Verifiers are <strong className="text-foreground">whitelisted automatically</strong> when
        a patient generates a credential. No manual registration is required.
      </p>
      <p>
        Admin signer: <span className="font-mono text-foreground">{admin}</span>
      </p>
      <p>
        Auto-whitelist:{" "}
        {autoWhitelist ? (
          <span className="text-emerald-600">enabled (VITE_DEPLOYER_SECRET_KEY set)</span>
        ) : (
          <span className="text-destructive">
            disabled — set VITE_DEPLOYER_SECRET_KEY in .env
          </span>
        )}
      </p>
      <p className="text-xs">
        Patients enter the verifier address on Passport → Share. If it is not yet registered,
        the app calls <code className="text-subtle">register_verifier</code> signed by the admin key.
      </p>
    </div>
  );
}
