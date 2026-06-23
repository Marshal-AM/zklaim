import { usePatientStore } from "../store/patientStore";

export function ClaimHistory() {
  const history = usePatientStore((s) => s.history);

  if (history.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No settled claims yet. History shows nullifiers only — no medical data.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {history.map((entry) => (
        <li key={entry.nullifier} className="surface-row px-4 py-3 text-sm">
          <p className="truncate font-mono text-xs text-muted-foreground">
            {entry.nullifier}
          </p>
          <p className="mt-1 text-xs text-subtle">
            {new Date(entry.submittedAt).toLocaleString()}
          </p>
        </li>
      ))}
    </ul>
  );
}
