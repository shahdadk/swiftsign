import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { emit } from "@/lib/webhooks";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const headersList = await headers();
    const ipAddress =
      headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      headersList.get("x-real-ip") ??
      "unknown";
    const userAgent = headersList.get("user-agent") ?? "unknown";

    const body = await request.json().catch(() => ({}));
    const reason = typeof body.reason === "string" ? body.reason : undefined;

    const recipient = await prisma.recipient.findUnique({
      where: { signingToken: token },
      include: { envelope: true },
    });

    if (!recipient) {
      return NextResponse.json(
        { error: "Invalid signing token" },
        { status: 404 }
      );
    }

    if (recipient.status === "SIGNED") {
      return NextResponse.json(
        { error: "Already signed, cannot decline" },
        { status: 409 }
      );
    }

    if (recipient.status === "DECLINED") {
      return NextResponse.json(
        { error: "Already declined" },
        { status: 409 }
      );
    }

    if (recipient.envelope.status !== "SENT") {
      return NextResponse.json(
        { error: `Envelope is ${recipient.envelope.status}` },
        { status: 409 }
      );
    }

    await prisma.$transaction([
      prisma.recipient.update({
        where: { id: recipient.id },
        data: { status: "DECLINED" },
      }),
      prisma.envelope.update({
        where: { id: recipient.envelope.id },
        data: { status: "DECLINED" },
      }),
    ]);

    await logAudit(recipient.envelope.id, "ENVELOPE_DECLINED", {
      actorName: recipient.name,
      actorEmail: recipient.email,
      ipAddress,
      userAgent,
      metadata: { recipientId: recipient.id, reason },
    });

    emit(recipient.envelope.userId, "envelope.declined", {
      envelopeId: recipient.envelope.id,
      recipientId: recipient.id,
      recipientEmail: recipient.email,
      reason: reason ?? null,
    });

    return NextResponse.json({
      status: "declined",
      message: "You have declined to sign this document.",
    });
  } catch (err) {
    logger.error(err, { route: "POST /api/sign/[token]/decline" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
