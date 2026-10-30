// v1.2.0 — postbuild: writes privacy.html, terms.html, cookies.html into dist (or the folder given)
// from src/i18n/{en,it}.json and src/data/policies.json; a missing text fails the build.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { buildPolicyPages } from '../src/utils/policyPages.js'

const read = rel => JSON.parse(readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8'))
const outName = process.argv[2] || 'dist'
const outDir = new URL(`../${outName}/`, import.meta.url)

if (!existsSync(outDir)) {
  console.error(`Policy pages: output folder ${outName}/ not found (run vite build first).`)
  process.exit(1)
}
try {
  const translations = { en: read('src/i18n/en.json'), it: read('src/i18n/it.json') }
  for (const { file, html } of buildPolicyPages(read('src/data/policies.json'), translations)) {
    writeFileSync(new URL(file, outDir), html)
    console.log(`Policy page written: ${outName}/${file}`)
  }
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
