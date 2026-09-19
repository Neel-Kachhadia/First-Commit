export function KavachMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M16 2.5 28 7v9.2c0 7.1-4.9 11.9-12 13.3C8.9 28.1 4 23.3 4 16.2V7l12-4.5Z"
        fill="currentColor"
        opacity="0.12"
      />
      <path
        d="M16 2.5 28 7v9.2c0 7.1-4.9 11.9-12 13.3C8.9 28.1 4 23.3 4 16.2V7l12-4.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M11 16.3h10M16 11.3v10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
