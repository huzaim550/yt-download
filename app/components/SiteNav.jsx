"use client";

import { useEffect, useState } from "react";
import { CloseIcon, DownloadIcon, MenuIcon } from "./Icons";

const NAV_LINKS = [
  { href: "#download", label: "Download" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#notes", label: "Notes" },
];

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60";

/**
 * Sticky site navigation with a mobile menu.
 * Links are anchors to the three sections of the single-page app.
 */
export default function SiteNav() {
  const [isOpen, setIsOpen] = useState(false);

  // Close the mobile menu if the viewport grows to desktop size.
  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const handleChange = (event) => {
      if (event.matches) setIsOpen(false);
    };

    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  // Escape closes the mobile menu.
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  function focusUrlInput() {
    setIsOpen(false);
    requestAnimationFrame(() => {
      document.getElementById("url")?.focus({ preventScroll: true });
    });
  }

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-ink/85 backdrop-blur-xl">
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8"
      >
        <a
          href="#top"
          className={`group flex items-center gap-2.5 rounded-lg ${FOCUS_RING}`}
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-signal text-ink transition group-hover:bg-ember">
            <DownloadIcon className="h-4 w-4" />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight text-paper">
            reel
          </span>
        </a>

        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-paper/5 hover:text-paper ${FOCUS_RING}`}
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <a
            href="#download"
            onClick={focusUrlInput}
            className={`hidden h-9 items-center rounded-lg bg-paper px-4 text-sm font-semibold text-ink transition hover:bg-ember focus-visible:ring-offset-2 focus-visible:ring-offset-ink sm:inline-flex ${FOCUS_RING}`}
          >
            Paste a link
          </a>

          <button
            type="button"
            onClick={() => setIsOpen((open) => !open)}
            aria-expanded={isOpen}
            aria-controls="mobile-nav"
            aria-label={isOpen ? "Close menu" : "Open menu"}
            className={`grid h-9 w-9 place-items-center rounded-lg border border-line text-paper transition hover:bg-paper/5 md:hidden ${FOCUS_RING}`}
          >
            {isOpen ? (
              <CloseIcon className="h-5 w-5" />
            ) : (
              <MenuIcon className="h-5 w-5" />
            )}
          </button>
        </div>
      </nav>

      {isOpen ? (
        <div
          id="mobile-nav"
          className="border-t border-line bg-ink px-4 py-3 shadow-2xl shadow-black/40 md:hidden"
        >
          <div className="mx-auto flex max-w-6xl flex-col">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className={`rounded-lg px-3 py-3 text-sm text-muted transition hover:bg-paper/5 hover:text-paper ${FOCUS_RING}`}
              >
                {link.label}
              </a>
            ))}

            <a
              href="#download"
              onClick={focusUrlInput}
              className={`mt-2 inline-flex h-11 items-center justify-center rounded-lg bg-paper px-4 text-sm font-semibold text-ink transition hover:bg-ember focus-visible:ring-offset-2 focus-visible:ring-offset-ink ${FOCUS_RING}`}
            >
              Paste a link
            </a>
          </div>
        </div>
      ) : null}
    </header>
  );
}
