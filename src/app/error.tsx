"use client";

// Last line of defence. Without this file a render error anywhere — one malformed
// API response reaching a component that reads a nested field — replaced the whole
// app with Next's default error screen. Now the page degrades to something Jose can
// read and retry from, and the error still reaches the console for us.

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen grid place-items-center bg-background px-6 font-mono">
      <div className="max-w-md text-center">
        <div className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Luxvance</div>
        <h1 className="mt-3 text-lg font-bold text-foreground">This screen hit an error</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Nothing was lost. Try again, and if it keeps happening the details are in the
          browser console.
        </p>
        {error?.digest && (
          <p className="mt-2 text-[11px] text-muted-foreground/70">Reference: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="mt-6 h-11 rounded-lg bg-gold px-6 text-sm font-bold text-ink-inverse transition-colors hover:bg-gold-hi"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
