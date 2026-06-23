import { useProviderStore } from "../store/providerStore";

export function ProviderHistory() {
  const history = useProviderStore((s) => s.history);

  if (history.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No claims submitted yet. History shows claim hash and date only.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {history.map((entry, i) => (
        <li
          key={`${entry.claim_hash}-${i}`}
          className="surface-row px-4 py-3 text-sm"
        >
          <p className="truncate font-mono text-xs text-muted-foreground">
            {entry.claim_hash}
          </p>
          <p className="mt-1 text-xs text-subtle">
            {new Date(entry.date).toLocaleString()}
          </p>
        </li>
      ))}
    </ul>
  );
}
