import { useProviderStore } from "../store/providerStore";

export function ProviderHistory() {
  const history = useProviderStore((s) => s.history);

  if (history.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No claims submitted yet. History shows claim hash and date only.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {history.map((entry, i) => (
        <li
          key={`${entry.claim_hash}-${i}`}
          className="rounded border border-slate-800 px-3 py-2 text-sm"
        >
          <p className="font-mono text-xs text-slate-400 truncate">
            {entry.claim_hash}
          </p>
          <p className="text-xs text-slate-500">
            {new Date(entry.date).toLocaleString()}
          </p>
        </li>
      ))}
    </ul>
  );
}
