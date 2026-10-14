export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">

        <header className="flex items-center justify-between">
          <div className="text-2xl font-bold">
            Agentflow<span className="text-cyan-400">AI</span>
          </div>

          <div className="flex gap-3">
            <button className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800">
              Login
            </button>

            <button className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300">
              Get Started
            </button>
          </div>
        </header>

        <section className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="mb-6 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-300">
            AI-Powered Workflow Automation
          </div>

          <h1 className="max-w-4xl text-5xl font-bold tracking-tight sm:text-6xl">
            Turn ideas into
            <span className="text-cyan-400"> intelligent workflows</span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg text-slate-400">
            Agentflow AI converts natural-language instructions into
            executable workflows that plan, execute, validate, recover,
            and monitor tasks automatically.
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <button className="rounded-xl bg-cyan-400 px-6 py-3 font-semibold text-slate-950 hover:bg-cyan-300">
              Build a Workflow
            </button>

            <button className="rounded-xl border border-slate-700 px-6 py-3 font-semibold hover:bg-slate-800">
              View Dashboard
            </button>
          </div>

          <div className="mt-16 grid w-full max-w-4xl grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="text-cyan-400">01</div>
              <h3 className="mt-2 font-semibold">Describe</h3>
              <p className="mt-2 text-sm text-slate-400">
                Tell Agentflow what you want.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="text-cyan-400">02</div>
              <h3 className="mt-2 font-semibold">Generate</h3>
              <p className="mt-2 text-sm text-slate-400">
                AI creates a workflow graph.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="text-cyan-400">03</div>
              <h3 className="mt-2 font-semibold">Execute</h3>
              <p className="mt-2 text-sm text-slate-400">
                Agents execute each step.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="text-cyan-400">04</div>
              <h3 className="mt-2 font-semibold">Monitor</h3>
              <p className="mt-2 text-sm text-slate-400">
                Watch execution in real time.
              </p>
            </div>
          </div>
        </section>

        <footer className="border-t border-slate-800 pt-6 text-center text-sm text-slate-500">
          Agentflow AI — Intelligent Automation Platform
        </footer>

      </div>
    </main>
  );
}