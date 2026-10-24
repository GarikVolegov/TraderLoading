import { useEffect } from "react";
import { useAuth } from "@clerk/react";
import { useLocation } from "wouter";
import LandingPage from "./LandingPage";

/** Legacy public entry points share the launch; training is always server-authorized. */
export default function ProtocolloPage() {
  const { isSignedIn } = useAuth();
  const [location, navigate] = useLocation();
  useEffect(() => {
    if (isSignedIn)
      navigate(location === "/sandbox" ? "/academy?tab=sandbox" : "/academy?tab=course", {
        replace: true,
      });
  }, [isSignedIn, location, navigate]);
  return isSignedIn ? <p role="status">Apertura del percorso LIMEN…</p> : <LandingPage />;
}
