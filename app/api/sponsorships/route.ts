import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import { Resend } from "resend";

const PACKAGE_OPTIONS = [
  "Cover Sponsor",
  "Monthly Sponsor",
  "Quarterly Sponsor",
] as const;

type SponsorshipPackage = (typeof PACKAGE_OPTIONS)[number];

type SponsorshipSubmission = {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  packageChoice: SponsorshipPackage;
  createdAt: string;
};

const claimKey = (pkg: SponsorshipPackage) => `sponsorships:claim:${pkg}`;
const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export async function GET() {
  const keys = PACKAGE_OPTIONS.map((pkg) => claimKey(pkg));
  const claims = await kv.mget<SponsorshipSubmission>(...keys);

  const submissions = claims
    .map((submission, index) => ({ submission, packageChoice: PACKAGE_OPTIONS[index] }))
    .filter((item) => Boolean(item.submission))
    .map((item) => item.submission as SponsorshipSubmission);

  return NextResponse.json({
    claimedSpots: submissions.map((submission) => submission.packageChoice),
    submissions,
  });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const companyName = String(body?.companyName ?? "").trim();
  const contactName = String(body?.contactName ?? "").trim();
  const email = String(body?.email ?? "").trim();
  const phone = String(body?.phone ?? "").trim();
  const packageChoice = String(body?.packageChoice ?? "").trim() as SponsorshipPackage;

  if (!companyName || !contactName || !email || !packageChoice) {
    return NextResponse.json(
      { error: "Company name, contact name, email, and package are required." },
      { status: 400 },
    );
  }

  if (!PACKAGE_OPTIONS.includes(packageChoice)) {
    return NextResponse.json({ error: "Invalid sponsorship package." }, { status: 400 });
  }

  const submission: SponsorshipSubmission = {
    companyName,
    contactName,
    email,
    phone,
    packageChoice,
    createdAt: new Date().toISOString(),
  };

  const wasClaimed = await kv.set(claimKey(packageChoice), submission, { nx: true });
  if (!wasClaimed) {
    return NextResponse.json({ error: "That sponsorship package has already been claimed." }, { status: 409 });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM;
  const notificationEmail = process.env.SPONSORSHIP_NOTIFICATION_EMAIL;

  if (!resendApiKey || !resendFrom || !notificationEmail) {
    await kv.del(claimKey(packageChoice));
    return NextResponse.json(
      { error: "Email delivery is not configured on the server." },
      { status: 500 },
    );
  }

  const resend = new Resend(resendApiKey);

  try {
    await resend.emails.send({
      from: resendFrom,
      to: notificationEmail,
      subject: `New Calendar Sponsorship: ${companyName} - ${packageChoice}`,
      html: `
        <h2>New Calendar Sponsorship Submission</h2>
        <p><strong>Company Name:</strong> ${escapeHtml(companyName)}</p>
        <p><strong>Contact Name:</strong> ${escapeHtml(contactName)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(phone || "N/A")}</p>
        <p><strong>Selected Package:</strong> ${escapeHtml(packageChoice)}</p>
      `,
    });
  } catch {
    await kv.del(claimKey(packageChoice));
    return NextResponse.json(
      { error: "Submission was not completed because the notification email failed." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, submission }, { status: 201 });
}
