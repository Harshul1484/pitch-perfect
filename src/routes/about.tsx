export function About() {
  return (
    <section>
      <h1 className="text-3xl font-semibold tracking-tight">About</h1>
      <p className="mt-3 max-w-prose text-muted">
        A second route, here to prove navigation works. Routes are declared in{' '}
        <code className="rounded bg-black/5 px-1.5 py-0.5 text-sm">
          src/router.tsx
        </code>
        .
      </p>
    </section>
  );
}
