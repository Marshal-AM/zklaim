import { usePatientStore } from "../store/patientStore";

export function ClaimHistory() {
  const history = usePatientStore((s) => s.history);

  if (history.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No settled claims yet. History shows nullifiers only — no medical data.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {history.map((entry) => (
        <li
          key={entry.nullifier}
          className="rounded border border-slate-800 px-3 py-2 text-sm"
        >
          <p className="font-mono text-xs text-slate-400 truncate">
            {entry.nullifier}
          </p>
          <p className="text-xs text-slate-500">
            {new Date(entry.submittedAt).toLocaleString()}
          </p>
        </li>
      ))}
    </ul>
  );
}
