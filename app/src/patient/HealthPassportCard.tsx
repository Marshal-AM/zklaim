import { ICD_CATEGORY_NAMES } from "../lib/passportCategories";

interface HealthPassportCardProps {
  leafCount: number;
  onChainCount: number | null;
  categories: string[];
}

function PassportEmblem() {
  return (
    <div className="health-passport__emblem" aria-hidden>
      <svg viewBox="0 0 48 48" fill="none" className="health-passport__emblem-icon">
        <circle
          cx="24"
          cy="24"
          r="21"
          stroke="currentColor"
          strokeWidth="1.5"
          opacity="0.45"
        />
        <path
          d="M24 8l3.2 9.8H37l-8.4 6.1 3.2 9.8L24 27.6l-7.8 5.7 3.2-9.8L11 17.8h9.8L24 8z"
          fill="currentColor"
          opacity="0.85"
        />
      </svg>
      <span className="health-passport__chip" />
    </div>
  );
}

export function HealthPassportCard({
  leafCount,
  onChainCount,
  categories,
}: HealthPassportCardProps) {
  const categoryLabels = categories.map(
    (c) => ICD_CATEGORY_NAMES[c] ?? `Category ${c}`,
  );

  return (
    <article className="health-passport" aria-label="Health Passport">
      <div className="health-passport__frame">
        <header className="health-passport__header">
          <p className="health-passport__issuer">ZKlaim Health</p>
          <div className="health-passport__header-row">
            <PassportEmblem />
            <div className="health-passport__identity">
              <p className="health-passport__doc-type">Health Passport</p>
              <h3 className="health-passport__doc-title">Your private medical record</h3>
            </div>
          </div>
        </header>

        <div className="health-passport__body">
          <div className="health-passport__stats">
            <div className="health-passport__field">
              <span className="health-passport__field-label">Claims in passport</span>
              <span className="health-passport__field-value health-passport__field-value--lg tabular-nums">
                {leafCount}
              </span>
            </div>
            {onChainCount !== null ? (
              <div className="health-passport__field">
                <span className="health-passport__field-label">On-chain leaves</span>
                <span className="health-passport__field-value tabular-nums">
                  {onChainCount}
                </span>
              </div>
            ) : null}
          </div>

          {categories.length > 0 ? (
            <div className="health-passport__field health-passport__field--wide">
              <span className="health-passport__field-label">Categories in history</span>
              <p className="health-passport__categories">
                {categoryLabels.map((label) => (
                  <span key={label} className="health-passport__category-tag">
                    {label}
                  </span>
                ))}
              </p>
            </div>
          ) : (
            <div className="health-passport__observations">
              <span className="health-passport__field-label">Observations</span>
              <p className="health-passport__observations-text">
                No claims in your passport yet. After settlement, click{" "}
                <span className="font-[650] text-foreground">Add to Passport</span> on
                the receipt (Submit tab) or on Patient → History. Passport data is stored
                per wallet in this browser (OPFS).
              </p>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
