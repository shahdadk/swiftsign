import Link from "next/link";

export default function SignNotFound() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-8 h-8 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Zm3.75 11.625a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold mb-3">Document Not Found</h1>
        <p className="text-gray-600 leading-relaxed">
          This signing link is invalid or has expired. Please check the link in
          your email or contact the sender for a new one.
        </p>
        <div className="mt-8">
          <Link
            href="/"
            className="text-primary hover:text-primary-dark font-medium transition-colors"
          >
            Go to SwiftSign
          </Link>
        </div>
      </div>
    </div>
  );
}
