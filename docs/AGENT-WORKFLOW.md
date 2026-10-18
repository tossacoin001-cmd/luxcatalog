# How Claude Code and Cline work together

1. **Pick or be given a task** in `TASKMANAGEMENT.md`. If it is not there, add
   it first with the template. If it needs a decision, put the question in
   `docs/DECISIONS.md` with a recommendation and stop.
2. **Branch** from `main`: `cline/T-0xx-short-name` or
   `claude/T-0xx-short-name`.
3. **Reproduce** with a command or a test. Write down what you ran and what you
   saw. If a tool does not work (a shell that returns nothing), say so and stop;
   do not write findings you could not check.
4. **Test first.** Add or extend a suite in `qa/suites/`, run it, and see it fail
   for the right reason.
5. **Fix** the smallest thing that makes it pass. Do not refactor around it.
6. **Run** the suite, then its neighbours (`docs/QA.md`), one at a time, then
   `npx tsc --noEmit` and `npx eslint src`.
7. **Hand over** in the task's section of `TASKMANAGEMENT.md`: branch, commits,
   what changed in plain words, test results (pass counts), anything you could
   not verify, and the next step.

## Limits

- No pushes to `main`, no force-pushes, no rewriting history.
- No production database access. No live payment keys. No secrets in files you
  commit, in logs, or in messages.
- No schema, auth, payment or webhook changes without a task that names them.
- No new third-party services without a decision.
- Handover notes must say what was **verified** and what was **assumed**.

## Where things are

- App: `src/` (Next.js 16, App Router, Prisma 7, own sign-in). Read
  `node_modules/next/dist/docs/` before relying on a Next.js API.
- Database changes: additive, re-runnable files in `prisma/sql/`, run by the
  Founder.
- Tests: `qa/` (see `docs/QA.md`).
- Decisions: `docs/DECISIONS.md`. Domain steps: `docs/DOMAIN.md`.
