import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-4 text-center">
      <div className="max-w-md">
        <p className="label-caps">Error 404</p>
        <h1 className="mt-2 text-3xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This route is not part of the KavachPay control plane.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Back to command center
        </Link>
      </div>
    </div>
  );
}
