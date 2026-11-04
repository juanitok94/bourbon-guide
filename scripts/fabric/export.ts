// Export the guide's data to Microsoft Fabric as CSV files in a Lakehouse (OneLake Files area).
// The repo JSON stays the source of truth for this direction.
//
//   npm run fabric:export           write fabric-out/*.csv locally (no network, always safe)
//   npm run fabric:export -- --push also upload them to OneLake (needs every FABRIC_* variable)
//
// In Fabric, load each file into a Delta table (Lakehouse > Files > ... > Load to Tables), or point a
// notebook / pipeline at the folder. Files are overwritten on every push.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { OUT_DIR, loadFabricConfig } from './config'
import { describeTarget, uploadFile } from './onelake'
import { TABLES, assertShape, toCsv } from './tables'

async function main() {
  const push = process.argv.includes('--push')
  mkdirSync(OUT_DIR, { recursive: true })

  const files: { name: string; csv: string; rows: number }[] = []
  for (const t of TABLES) {
    const rows = JSON.parse(readFileSync(join(process.cwd(), t.file), 'utf8')) as Record<string, unknown>[]
    assertShape(t, rows)
    const csv = toCsv(t, rows)
    writeFileSync(join(OUT_DIR, `${t.name}.csv`), csv)
    files.push({ name: `${t.name}.csv`, csv, rows: rows.length })
    console.log(`wrote fabric-out/${t.name}.csv (${rows.length} rows, ${t.columns.length} columns)`)
  }

  if (!push) {
    console.log('dry run: nothing uploaded. Add --push to upload to OneLake.')
    return
  }
  const { config, missing } = loadFabricConfig()
  if (!config) {
    console.error(`fabric:export --push needs: ${missing.join(', ')} (see .env.example). Nothing uploaded.`)
    process.exit(1)
  }
  console.log(`uploading to ${describeTarget(config)}`)
  for (const f of files) {
    await uploadFile(config, f.name, f.csv)
    console.log(`  uploaded ${f.name} (${f.rows} rows)`)
  }
}

main().catch((e: Error) => {
  console.error(`fabric:export failed: ${e.message}`)
  process.exit(1)
})
