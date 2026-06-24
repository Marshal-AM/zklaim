import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { RoleChooser } from "../components/RoleChooser";

/** Landing — role selection. Deep links with ?claim= route to patient inbox. */
export function HomePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const claim = searchParams.get("claim");
    if (claim) {
      navigate(`/patient/inbox?claim=${encodeURIComponent(claim)}`, {
        replace: true,
      });
    }
  }, [searchParams, navigate]);

  return <RoleChooser />;
}
