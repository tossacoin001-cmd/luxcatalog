// Writes the current list of partner agreements for the suites that sign
// them (run.sh calls this first so the suites never go stale).
import { AGREEMENTS } from '../src/lib/agreements'
import { writeFileSync } from 'node:fs'
writeFileSync(new URL('./suites/.agreements-list.generated.mjs', import.meta.url), `export const AGREEMENTS = ${JSON.stringify(AGREEMENTS.map((a) => ({ key: a.key, version: a.version, title: a.title })))}\n`)
