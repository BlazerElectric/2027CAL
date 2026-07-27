"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

const PACKAGE_OPTIONS = [
  "Cover Sponsor",
  "Monthly Sponsor",
  "Quarterly Sponsor",
] as const;

type SponsorshipPackage = (typeof PACKAGE_OPTIONS)[number];

type FormState = {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  packageChoice: SponsorshipPackage;
};

export default function HomePage() {
  const [claimedSpots, setClaimedSpots] = useState<SponsorshipPackage[]>([]);
  const [isLoadingClaims, setIsLoadingClaims] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [form, setForm] = useState<FormState>({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    packageChoice: PACKAGE_OPTIONS[0],
  });

  const availablePackages = useMemo(
    () => PACKAGE_OPTIONS.filter((pkg) => !claimedSpots.includes(pkg)),
    [claimedSpots],
  );

  const loadClaims = async () => {
    try {
      setIsLoadingClaims(true);
      const response = await fetch("/api/sponsorships", { method: "GET" });
      const data = await response.json();
      setClaimedSpots(data?.claimedSpots ?? []);
    } finally {
      setIsLoadingClaims(false);
    }
  };

  useEffect(() => {
    void loadClaims();
  }, []);

  useEffect(() => {
    if (!claimedSpots.includes(form.packageChoice)) return;
    const nextAvailable = availablePackages[0];
    if (nextAvailable) {
      setForm((current) => ({ ...current, packageChoice: nextAvailable }));
    }
  }, [availablePackages, claimedSpots, form.packageChoice]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/sponsorships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatusMessage(data?.error ?? "Unable to submit sponsorship at this time.");
        await loadClaims();
        return;
      }

      setStatusMessage("Thank you! Your sponsorship request has been submitted.");
      setForm({
        companyName: "",
        contactName: "",
        email: "",
        phone: "",
        packageChoice: availablePackages[0] ?? PACKAGE_OPTIONS[0],
      });
      await loadClaims();
    } catch {
      setStatusMessage("Something went wrong while submitting. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto w-full max-w-2xl rounded-xl bg-white p-8 shadow-md">
        <h1 className="text-3xl font-semibold">2027 Calendar Sponsorship Signup</h1>
        <p className="mt-2 text-sm text-slate-600">Blazer Electric Supply</p>

        <form className="mt-8 space-y-5" onSubmit={onSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="companyName">
              Company Name *
            </label>
            <input
              id="companyName"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
              value={form.companyName}
              onChange={(event) => setForm((current) => ({ ...current, companyName: event.target.value }))}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="contactName">
              Contact Person Name *
            </label>
            <input
              id="contactName"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
              value={form.contactName}
              onChange={(event) => setForm((current) => ({ ...current, contactName: event.target.value }))}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="email">
              Email Address *
            </label>
            <input
              id="email"
              type="email"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="phone">
              Phone Number
            </label>
            <input
              id="phone"
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            />
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Sponsorship Package Choice *</legend>
            <div className="space-y-2">
              {PACKAGE_OPTIONS.map((pkg) => {
                const isClaimed = claimedSpots.includes(pkg);
                return (
                  <label
                    key={pkg}
                    className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                      isClaimed ? "border-slate-200 bg-slate-100 text-slate-400" : "border-slate-300"
                    }`}
                  >
                    <span>{pkg}</span>
                    <span className="flex items-center gap-2 text-sm">
                      {isClaimed ? "Claimed" : "Available"}
                      <input
                        type="radio"
                        name="packageChoice"
                        value={pkg}
                        checked={form.packageChoice === pkg}
                        disabled={isClaimed || isLoadingClaims}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, packageChoice: event.target.value as SponsorshipPackage }))
                        }
                      />
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <button
            type="submit"
            className="w-full rounded-md bg-slate-900 px-4 py-2 font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting || isLoadingClaims || availablePackages.length === 0}
          >
            {isSubmitting ? "Submitting..." : availablePackages.length === 0 ? "All packages claimed" : "Submit"}
          </button>
        </form>

        {statusMessage ? <p className="mt-4 text-sm text-slate-700">{statusMessage}</p> : null}
      </div>
    </main>
  );
}
