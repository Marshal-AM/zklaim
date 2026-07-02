import { useEffect, useState } from "react";
import {
  formatTreeAlignmentError,
  verifyTreeChainAlignment,
  type TreeAlignmentReport,
} from "../lib/treeChainAlignment";

export function TreeAlignmentBanner() {
  const [report, setReport] = useState<TreeAlignmentReport | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void verifyTreeChainAlignment()
      .then((r) => {
        if (!cancelled) setReport(r);
      })
      .catch((err) => {
        if (!cancelled) {
          setReport({
            aligned: false,
            manifestGeneratedAt: "",
            artifactRoots: {
              policy: "",
              asp: "",
              fraud: "",
              aspDoctorCount: 0,
            },
            onChainRoots: {
              policy: "",
              asp: "",
              fraud: "",
              aspLeafCount: 0,
            },
            mismatches: [
              {
                label: "Alignment check",
                expected: "reachable RPC + synced trees",
                actual: err instanceof Error ? err.message : "failed",
              },
            ],
          });
        }
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (checking || !report || report.aligned) {
    return null;
  }

  const technicalFailure = report.mismatches.some(
    (m) => m.label === "Alignment check",
  );

  return (
    <div className="info-card border-destructive/40 bg-destructive/10 p-4 text-sm">
      <p className="font-[650] text-destructive">
        {technicalFailure
          ? "Could not verify tree alignment"
          : "Tree / contract misalignment"}
      </p>
      <p className="mt-2 text-muted-foreground">
        {technicalFailure
          ? report.mismatches.map((m) => m.actual).join(" ")
          : formatTreeAlignmentError(report)}
      </p>
    </div>
  );
}
