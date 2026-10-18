import { BrandMark } from "@/components/BrandMark";
import { useEffect, useRef, useState, type RefObject } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpRight, ChevronDown, Globe2, LogIn, Menu, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { LANGUAGES, useLanguage, type Language } from "@/contexts/LanguageContext";
import { landingPath } from "@/lib/seo";
import { SignupCta } from "./shared";

const NAV_LINKS = [
  { href: "#features", key: "landing.nav.features" },
  { href: "#how", key: "landing.nav.how" },
  { href: "#pricing", key: "landing.nav.pricing" },
  { href: "#faq", key: "landing.nav.faq" },
] as const;

export function LandingNavigation({
  headerRef,
  onStart,
}: {
  headerRef: RefObject<HTMLElement | null>;
  onStart: () => void;
}) {
  const { t, language, setLanguage } = useLanguage();
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const firstLink = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 961px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  const navigate = (href: string) => {
    setOpen(false);
    if (href === "#how") onStart();
  };
  const changeLanguage = (next: Language) => {
    setLanguage(next);
    setLocation(landingPath(next));
    setOpen(false);
  };
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <header className="landing-header" ref={headerRef}>
        <div className="landing-header-inner">
          <Link href={landingPath(language)} className="landing-brand">
            <BrandMark />
          </Link>
          <nav className="landing-navigation" aria-label={t("landing.nav.label")}>
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} onClick={() => navigate(link.href)}>
                {t(link.key)}
              </a>
            ))}
          </nav>
          <div className="landing-header-actions">
            <Link className="landing-sign-in" href="/sign-in">
              {t("landing.nav.sign_in")}
            </Link>
            <div className="landing-desktop-language">
              <label className="sr-only" htmlFor="landing-language">
                {t("landing.language.label")}
              </label>
              <select
                id="landing-language"
                value={language}
                onChange={(event) => changeLanguage(event.target.value as Language)}
              >
                {Object.entries(LANGUAGES).map(([code, config]) => (
                  <option key={code} value={code}>
                    {config.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} aria-hidden="true" />
            </div>
            <SignupCta placement="navigation" compact />
            <Dialog.Trigger asChild>
              <button className="landing-menu-trigger" aria-label={t("landing.nav.open")}>
                <Menu size={22} aria-hidden="true" />
              </button>
            </Dialog.Trigger>
          </div>
        </div>
      </header>
      <Dialog.Portal>
        <div className="landing-page landing-menu-layer">
          <Dialog.Overlay className="landing-menu-overlay" />
          <Dialog.Content
            className="landing-menu-panel"
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              firstLink.current?.focus();
            }}
            onCloseAutoFocus={(event) => {
              if (window.matchMedia("(min-width: 961px)").matches) {
                event.preventDefault();
                headerRef.current
                  ?.querySelector<HTMLAnchorElement>(".landing-navigation a")
                  ?.focus();
              }
            }}
          >
            <div className="landing-menu-heading">
              <Dialog.Title>{t("landing.nav.label")}</Dialog.Title>
              <Dialog.Close asChild>
                <button className="landing-menu-close" aria-label={t("landing.nav.close")}>
                  <X size={22} aria-hidden="true" />
                </button>
              </Dialog.Close>
            </div>
            <Dialog.Description className="sr-only">
              {t("landing.nav.description")}
            </Dialog.Description>
            <nav aria-label={t("landing.nav.label")}>
              {NAV_LINKS.map((link, index) => (
                <a
                  key={link.href}
                  ref={index === 0 ? firstLink : undefined}
                  href={link.href}
                  onClick={() => navigate(link.href)}
                >
                  <span>{t(link.key)}</span>
                  <ArrowUpRight size={20} aria-hidden="true" />
                </a>
              ))}
            </nav>
            <div className="landing-menu-settings">
              <div className="landing-menu-language">
                <label htmlFor="landing-mobile-language">
                  <Globe2 size={18} aria-hidden="true" />
                  {t("landing.language.label")}
                </label>
                <select
                  id="landing-mobile-language"
                  value={language}
                  onChange={(event) => changeLanguage(event.target.value as Language)}
                >
                  {Object.entries(LANGUAGES).map(([code, config]) => (
                    <option key={code} value={code}>
                      {config.name}
                    </option>
                  ))}
                </select>
              </div>
              <Link href="/sign-in" onClick={() => setOpen(false)}>
                <LogIn size={18} aria-hidden="true" />
                {t("landing.nav.sign_in")}
              </Link>
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
