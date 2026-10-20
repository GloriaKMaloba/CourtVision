import { Link } from "react-router-dom";
import cvLogoWatermark from "../assets/cv-logo-hero-banner.png";

// Small reusable shot-arc icon — used as the visual thread across metric cards
function ArcIcon({ variant = "angle", className = "" }) {
  if (variant === "angle") {
    return (
      <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
        <path
          d="M8 56 Q 32 8 56 56"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="8" cy="56" r="3" fill="currentColor" />
        <circle cx="56" cy="56" r="3" fill="currentColor" />
        <path
          d="M8 56 L 20 56 M8 56 A 12 12 0 0 1 14 46"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="2 2"
          opacity="0.6"
        />
      </svg>
    );
  }
  if (variant === "jump") {
    return (
      <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
        <line x1="12" y1="52" x2="52" y2="52" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
        <line x1="20" y1="52" x2="20" y2="14" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
        <circle cx="20" cy="14" r="5" fill="currentColor" />
        <circle cx="20" cy="52" r="2.5" fill="currentColor" opacity="0.5" />
      </svg>
    );
  }
  // classification
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path d="M8 52 A 24 24 0 0 1 56 52" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.35" />
      <path d="M20 52 A 12 12 0 0 1 44 52" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="32" cy="52" r="3" fill="currentColor" />
    </svg>
  );
}

const metrics = [
  {
    variant: "angle",
    label: "Shooting Angle",
    detail: "Release angle at the point of the shot, tracked frame by frame.",
  },
  {
    variant: "jump",
    label: "Jump Height",
    detail: "Vertical explosiveness at release, measured from pose landmarks.",
  },
  {
    variant: "classification",
    label: "Shot Classification",
    detail: "Two-point vs. three-point attempts, tagged automatically.",
  },
];

const steps = [
  { n: "01", title: "Record", detail: "Film a shooting session on any smartphone." },
  { n: "02", title: "Upload", detail: "Send the footage through the web interface." },
  { n: "03", title: "Analyze", detail: "The system processes every frame." },
  { n: "04", title: "Score", detail: "Metrics land on the athlete's dashboard." },
];

export default function Landing() {
  return (
    <div className="bg-[#FAFAF9] text-cv-navy">
      {/* ---------- HERO ---------- */}
      <section className="relative overflow-hidden min-h-[560px] flex items-center px-6 py-20">
        <img
          src={cvLogoWatermark}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />

        <div className="relative z-10 mx-auto w-full max-w-2xl">
          <div className="rounded-3xl bg-white/85 backdrop-blur-sm px-8 py-10 text-center shadow-lg sm:px-12 sm:py-14">
            <h1 className="gradient-heading font-display text-4xl leading-tight md:text-6xl">
              Talent doesn't need
              <br />
              a scout in the room.
            </h1>

            <p className="font-body mx-auto mt-5 max-w-md text-base text-cv-navy/70 md:text-lg">
              Upload a shot. CourtVision reads the angle, lift and range.
              No clipboard required.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/register"
                className="bg-cv-orange font-body w-full rounded-full px-7 py-3 text-center font-medium text-white shadow-sm transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-cv-orange focus-visible:ring-offset-2 sm:w-auto"
              >
                Register
              </Link>
              <Link
                to="/login"
                className="font-body w-full rounded-full border border-cv-navy/20 px-7 py-3 text-center font-medium text-cv-navy transition hover:border-cv-navy/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-cv-navy focus-visible:ring-offset-2 sm:w-auto"
              >
                Login
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- HOW IT WORKS ---------- */}
      <section className="border-t border-cv-navy/10 bg-white px-6 py-16 md:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-display text-center text-2xl text-cv-navy md:text-3xl">
            How it works
          </h2>

          <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <div key={s.n} className="relative">
                <span className="font-display text-cv-orange/30 text-3xl">
                  {s.n}
                </span>
                <h3 className="font-display mt-2 text-lg text-cv-navy">
                  {s.title}
                </h3>
                <p className="font-body mt-1 text-sm text-cv-navy/65">
                  {s.detail}
                </p>
                {i < steps.length - 1 && (
                  <span
                    className="absolute right-[-1.25rem] top-3 hidden text-cv-navy/20 lg:block"
                    aria-hidden="true"
                  >
                    →
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- WHAT YOU GET ---------- */}
      <section className="border-t border-cv-navy/10 px-6 py-16 md:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-display text-center text-2xl text-cv-navy md:text-3xl">
            Three numbers per shot
          </h2>

          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {metrics.map((m) => (
              <div
                key={m.label}
                className="rounded-2xl border border-cv-navy/10 bg-white p-6 transition hover:border-cv-orange/40"
              >
                <ArcIcon variant={m.variant} className="h-12 w-12 text-cv-orange" />
                <h3 className="font-display mt-4 text-lg text-cv-navy">
                  {m.label}
                </h3>
                <p className="font-body mt-2 text-sm text-cv-navy/65">
                  {m.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- FOOTER CTA ---------- */}
      <section className="border-t border-cv-navy/10 bg-cv-navy px-6 py-16 text-center md:py-20">
        <h2 className="font-display text-2xl text-white md:text-3xl">
          CourtVision.
          <br className="sm:hidden" /> Identifies talent.
        </h2>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/register"
            className="bg-cv-orange font-body w-full rounded-full px-7 py-3 text-center font-medium text-white shadow-sm transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-cv-orange focus-visible:ring-offset-2 sm:w-auto"
          >
            Register
          </Link>
          <Link
            to="/login"
            className="font-body w-full rounded-full border border-white/30 px-7 py-3 text-center font-medium text-white transition hover:border-white/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-cv-navy sm:w-auto"
          >
            Login
          </Link>
        </div>
      </section>
    </div>
  );
}
