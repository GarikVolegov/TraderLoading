import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`.replace(/\/+/g, "/");
    navigator.serviceWorker
      .register(swUrl, { scope: import.meta.env.BASE_URL || "/" })
      .catch((err) => console.warn("SW registration failed:", err));
  });
}
