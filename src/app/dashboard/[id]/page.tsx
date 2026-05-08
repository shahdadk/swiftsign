import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { notFound, redirect } from 'next/navigation';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SENT: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  DECLINED: 'bg-red-100 text-red-700',
  VOIDED: 'bg-yellow-100 text-yellow-700',
  PENDING: 'bg-gray-100 text-gray-600',
  DELIVERED: 'bg-blue-50 text-blue-600',
  SIGNED: 'bg-green-100 text-green-700',
};

export default async function EnvelopeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) redirect('/dashboard/login');

  const { id } = await params;

  const envelope = await prisma.envelope.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true } },
      documents: { select: { id: true, name: true, signedKey: true, documentHash: true } },
      recipients: {
        select: { id: true, name: true, email: true, role: true, status: true, routingOrder: true, signedAt: true, viewedAt: true, signingToken: true },
        orderBy: { routingOrder: 'asc' },
      },
      auditLogs: {
        select: { id: true, event: true, actorName: true, actorEmail: true, ipAddress: true, createdAt: true, metadata: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!envelope) return notFound();

  // Ensure the envelope belongs to the authenticated user
  if (envelope.userId !== user.id) return notFound();

  return (
    <>
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <div>
            <h1 className="font-semibold text-gray-900">{envelope.subject}</h1>
            <p className="text-sm text-gray-500">Created {new Date(envelope.createdAt).toLocaleString()}</p>
          </div>
          <span className={`ml-auto text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[envelope.status]}`}>
            {envelope.status}
          </span>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Recipients */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Recipients</h2>
          <div className="space-y-3">
            {envelope.recipients.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className="font-medium text-gray-900">{r.name}</p>
                  <p className="text-sm text-gray-500">{r.email}</p>
                  {r.viewedAt && (
                    <p className="text-xs text-gray-400">Viewed {new Date(r.viewedAt).toLocaleString()}</p>
                  )}
                  {r.signedAt && (
                    <p className="text-xs text-green-600">Signed {new Date(r.signedAt).toLocaleString()}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Order {r.routingOrder}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status]}`}>
                    {r.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Documents */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Documents</h2>
          <div className="space-y-2">
            {envelope.documents.map((doc, i) => (
              <div key={doc.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-gray-900">{doc.name}</p>
                  {doc.documentHash && (
                    <p className="text-xs text-gray-400 font-mono">SHA-256: {doc.documentHash.slice(0, 16)}...</p>
                  )}
                </div>
                {doc.signedKey && (
                  <a
                    href={`/api/envelopes/${envelope.id}/download?doc=${i}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Download signed
                  </a>
                )}
              </div>
            ))}
            {envelope.status === 'COMPLETED' && (
              <div className="flex items-center justify-between py-2 border-t border-gray-100">
                <p className="font-medium text-gray-900">Certificate of Completion</p>
                <a
                  href={`/api/envelopes/${envelope.id}/download?certificate=true`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Download
                </a>
              </div>
            )}
          </div>
        </section>

        {/* Audit Trail */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Audit Trail</h2>
          <div className="space-y-3">
            {envelope.auditLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">{log.event.replace(/_/g, ' ')}</span>
                    {log.actorName && (
                      <span className="text-xs text-gray-500">by {log.actorName}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                    <span>{new Date(log.createdAt).toLocaleString()}</span>
                    {log.ipAddress && <span>IP: {log.ipAddress}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
