import { Counter } from '../components/counter';

export function Home() {
  return (
    <section>
      <h1 className="text-3xl font-semibold tracking-tight">
        React + TypeScript starter
      </h1>
      <p className="mt-3 max-w-prose text-muted">
        Routing, styling, tests, and linting are wired up and passing. The
        counter below exists so the example test has something real to assert
        against — delete both when you start building.
      </p>

      <div className="mt-8">
        <Counter />
      </div>
    </section>
  );
}
