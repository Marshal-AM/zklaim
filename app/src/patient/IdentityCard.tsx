import { env } from "../config/env";
import { usePatientStore } from "../store/patientStore";
import { useWalletStore } from "../store/wallet";

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
    <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4 space-y-3 text-sm">
      {env.isSupabaseEnabled() ? (
        <p className="text-slate-400">
          You are registered in the ZKlaim directory. Doctors can send claims
          using only your Stellar address — no need to share your encryption
          key manually.
        </p>
      ) : (
        <p className="text-slate-400">
          Share your public encryption key with your doctor so they can send you
          claims:
        </p>
      )}
      {address ? (
        <div className="space-y-1">
          <p className="text-xs text-slate-500">Stellar address (share with doctor)</p>
          <code className="block text-xs font-mono text-slate-300 break-all bg-slate-950 p-2 rounded">
            {address}
          </code>
          <button
            type="button"
            onClick={copyAddress}
            className="text-xs text-sky-400 hover:underline"
          >
            Copy Stellar address
          </button>
        </div>
      ) : identity.stellar_address ? (
        <div className="space-y-1">
          <p className="text-xs text-slate-500">Stellar address (share with doctor)</p>
          <code className="block text-xs font-mono text-slate-300 break-all bg-slate-950 p-2 rounded">
            {identity.stellar_address}
          </code>
        </div>
      ) : (
        <p className="text-xs text-amber-400">
          Connect Freighter to show your Stellar address for doctors.
        </p>
      )}
      <div className="space-y-1">
        <p className="text-xs text-slate-500">Public encryption key</p>
        <code className="block text-xs font-mono text-slate-300 break-all bg-slate-950 p-2 rounded">
          {identity.box_public_key.slice(0, 48)}…
        </code>
        <button
          type="button"
          onClick={copyKey}
          className="text-xs text-sky-400 hover:underline"
        >
          Copy public encryption key
        </button>
      </div>
    </div>
  );
}
