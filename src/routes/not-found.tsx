import { Link } from 'react-router';

export function NotFound() {
  return (
    <section>
      <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-3 text-muted">
        That route isn&rsquo;t in the table.{' '}
        <Link to="/" className="text-accent underline underline-offset-4">
          Go home
        </Link>
      </p>
    </section>
  );
}
