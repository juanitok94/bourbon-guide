// Microsoft Fabric (OneLake) settings for the export and pull scripts. Build-time / CLI only:
// nothing here is ever imported by the site, so no secret can reach the static bundle.
// Never prefix these with NEXT_PUBLIC_.
//
// Set them in .env.local (gitignored; see .env.example) or in the shell.
//   FABRIC_WORKSPACE      workspace name or GUID
//   FABRIC_LAKEHOUSE      lakehouse name (no ".Lakehouse" suffix) or GUID
//   FABRIC_FOLDER         folder under the lakehouse Files area (default "bourbon-guide")
//   FABRIC_TENANT_ID      Entra ID tenant
//   FABRIC_CLIENT_ID      app registration (service principal) with access to the workspace
//   FABRIC_CLIENT_SECRET  its client secret
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export type FabricConfig = {
  workspace: string
  lakehouse: string
  folder: string
  tenantId: string
  clientId: string
  clientSecret: string
}

const ENV_FILE = join(process.cwd(), '.env.local')
if (existsSync(ENV_FILE)) {
  try {
    process.loadEnvFile(ENV_FILE) // Node 20.12+; does not overwrite variables already set
  } catch (e) {
    console.warn(`fabric: could not read .env.local (${(e as Error).message})`)
  }
}

const REQUIRED = [
  'FABRIC_WORKSPACE',
  'FABRIC_LAKEHOUSE',
  'FABRIC_TENANT_ID',
  'FABRIC_CLIENT_ID',
  'FABRIC_CLIENT_SECRET',
] as const

// Returns the config, or null with the list of missing variables (= offline / dry-run mode).
export function loadFabricConfig(): { config: FabricConfig | null; missing: string[] } {
  const missing = REQUIRED.filter((k) => !process.env[k]?.trim())
  if (missing.length) return { config: null, missing }
  const env = (k: string) => process.env[k]!.trim()
  return {
    config: {
      workspace: env('FABRIC_WORKSPACE'),
      lakehouse: env('FABRIC_LAKEHOUSE'),
      folder: (process.env.FABRIC_FOLDER ?? 'bourbon-guide').trim().replace(/^\/+|\/+$/g, ''),
      tenantId: env('FABRIC_TENANT_ID'),
      clientId: env('FABRIC_CLIENT_ID'),
      clientSecret: env('FABRIC_CLIENT_SECRET'),
    },
    missing: [],
  }
}

// Local working folders (gitignored).
export const OUT_DIR = join(process.cwd(), 'fabric-out') // what export writes / uploads
export const IN_DIR = join(process.cwd(), 'fabric-in') // what pull downloads / stages
