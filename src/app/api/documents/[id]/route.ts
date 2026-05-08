import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { downloadPdf } from "@/lib/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { error: "Missing signing token" },
      { status: 401 }
    );
  }

  // Validate token and ensure the recipient belongs to the same envelope as the document
  const recipient = await prisma.recipient.findUnique({
    where: { signingToken: token },
    select: { envelopeId: true },
  });

  if (!recipient) {
    return NextResponse.json(
      { error: "Invalid signing token" },
      { status: 401 }
    );
  }

  const document = await prisma.document.findUnique({
    where: { id },
    select: { envelopeId: true, originalKey: true, name: true },
  });

  if (!document) {
    return NextResponse.json(
      { error: "Document not found" },
      { status: 404 }
    );
  }

  if (document.envelopeId !== recipient.envelopeId) {
    return NextResponse.json(
      { error: "Access denied" },
      { status: 403 }
    );
  }

  try {
    const pdfBuffer = await downloadPdf(document.originalKey);
    const base64 = pdfBuffer.toString("base64");

    return NextResponse.json({ base64, name: document.name });
  } catch (error) {
    console.error("Failed to fetch document PDF:", error);
    return NextResponse.json(
      { error: "Failed to load document" },
      { status: 500 }
    );
  }
}
