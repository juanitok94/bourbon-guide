// Pull the guide's data back from Microsoft Fabric (the same Lakehouse CSV files export writes) and
// rebuild stops.json, groups.json and brands.json. Build-time only; the site stays static.
//
//   npm run fabric:pull                 download from OneLake into fabric-in/ and stage JSON (needs FABRIC_*)
//   npm run fabric:pull -- --local      skip the network; read fabric-out/*.csv (round-trip test)
//   ... --apply                         after staging, replace src/data/*.json and run check:data
//
// Without --apply nothing in src/data changes, so a bad Fabric edit can't reach a build unreviewed.
// With --apply, check:data runs right after; on failure the previous files are restored.
import { execSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { IN_DIR, OUT_DIR, loadFabricConfig } from './config'
import { describeTarget, downloadFile } from './onelake'
import { TABLES, fromCsv } from './tables'

async function main() {
  const local = process.argv.includes('--local')
  const apply = process.argv.includes('--apply')
  mkdirSync(IN_DIR, { recursive: true })

  const config = local ? null : loadFabricConfig()
  if (!local && !config?.config) {
    console.error(
      `fabric:pull needs: ${config?.missing.join(', ')} (see .env.example).\n` +
        'Run npm run fabric:pull -- --local to test the round trip from fabric-out/ instead.',
    )
    process.exit(1)
  }
  if (config?.config) console.log(`reading from ${describeTarget(config.config)}`)

  const staged: { table: string; file: string; json: string; same: boolean }[] = []
  for (const t of TABLES) {
    let csv: string
    if (local) {
      const p = join(OUT_DIR, `${t.name}.csv`)
      if (!existsSync(p)) throw new Error(`missing fabric-out/${t.name}.csv; run npm run fabric:export first`)
      csv = readFileSync(p, 'utf8')
    } else {
      csv = await downloadFile(config!.config!, `${t.name}.csv`)
      writeFileSync(join(IN_DIR, `${t.name}.csv`), csv)
    }
    const rows = fromCsv(t, csv)
    const json = JSON.stringify(rows, null, 2) + '\n'
    writeFileSync(join(IN_DIR, `${t.name}.json`), json)
    const current = readFileSync(join(process.cwd(), t.file), 'utf8')
    const same = JSON.stringify(JSON.parse(current)) === JSON.stringify(rows)
    staged.push({ table: t.name, file: t.file, json, same })
    console.log(`staged fabric-in/${t.name}.json (${rows.length} rows) ${same ? 'identical to' : 'DIFFERS from'} ${t.file}`)
  }

  if (!apply) {
    console.log('nothing applied. Review fabric-in/*.json, then re-run with --apply.')
    return
  }

  // Back up, replace, validate; roll back if check:data fails. Unchanged tables are left alone
  // so their hand formatting in the repo isn't churned.
  const changed = staged.filter((s) => !s.same)
  if (!changed.length) {
    console.log('nothing to apply: Fabric matches src/data.')
    return
  }
  const backups = changed.map((s) => {
    const src = join(process.cwd(), s.file)
    const bak = join(IN_DIR, `${s.table}.json.bak`)
    copyFileSync(src, bak)
    return { src, bak }
  })
  changed.forEach((s) => writeFileSync(join(process.cwd(), s.file), s.json))
  try {
    execSync('npm run check:data', { stdio: 'inherit' })
    console.log('applied: src/data updated and check:data passed. Review the git diff before committing.')
  } catch {
    backups.forEach((b) => copyFileSync(b.bak, b.src))
    console.error('check:data failed: src/data restored to its previous state. Fix the data in Fabric and pull again.')
    process.exit(1)
  }
}

main().catch((e: Error) => {
  console.error(`fabric:pull failed: ${e.message}`)
  process.exit(1)
})
