// Thin OneLake client: Entra ID client-credentials token + the ADLS Gen2 (DFS) file API that OneLake exposes.
// STUB STATUS: written against the documented APIs but NOT yet run against a real Fabric workspace.
// Test with a throwaway lakehouse first. Only called when every FABRIC_* variable is set.
//
// Docs: OneLake access via ADLS Gen2 APIs; endpoint https://onelake.dfs.fabric.microsoft.com
//   path: /<workspace>/<lakehouse>.Lakehouse/Files/<folder>/<file>
//   token scope: https://storage.azure.com/.default
// TODO(fabric): prefer a managed identity / workload identity federation over a client secret once deployed.
import type { FabricConfig } from './config'

const DFS = 'https://onelake.dfs.fabric.microsoft.com'
const API_VERSION = '2023-11-03'

let cached: { token: string; expires: number } | null = null

async function token(cfg: FabricConfig): Promise<string> {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token
  const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(cfg.tenantId)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      scope: 'https://storage.azure.com/.default',
    }),
  })
  if (!res.ok) throw new Error(`Entra ID token request failed: ${res.status} ${await safeText(res)}`)
  const body = (await res.json()) as { access_token: string; expires_in: number }
  cached = { token: body.access_token, expires: Date.now() + body.expires_in * 1000 }
  return cached.token
}

// Lakehouse names are used with the ".Lakehouse" item suffix; GUIDs are used as-is.
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function fileUrl(cfg: FabricConfig, file: string): string {
  const item = GUID.test(cfg.lakehouse) ? cfg.lakehouse : `${cfg.lakehouse}.Lakehouse`
  const parts = [cfg.workspace, item, 'Files', ...cfg.folder.split('/').filter(Boolean), file]
  return `${DFS}/${parts.map(encodeURIComponent).join('/')}`
}

async function call(cfg: FabricConfig, url: string, init: RequestInit, what: string): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${await token(cfg)}`, 'x-ms-version': API_VERSION, ...init.headers },
  })
  if (!res.ok) throw new Error(`OneLake ${what} failed: ${res.status} ${await safeText(res)}`)
  return res
}

// Error bodies can echo request details; keep them short and never print headers.
async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300)
  } catch {
    return ''
  }
}

// ADLS Gen2 upload = create (overwrites) -> append -> flush.
export async function uploadFile(cfg: FabricConfig, file: string, content: string): Promise<string> {
  const url = fileUrl(cfg, file)
  const data = new TextEncoder().encode(content)
  await call(cfg, `${url}?resource=file`, { method: 'PUT' }, `create ${file}`)
  await call(
    cfg,
    `${url}?action=append&position=0`,
    { method: 'PATCH', body: data, headers: { 'Content-Type': 'application/octet-stream' } },
    `append ${file}`,
  )
  await call(cfg, `${url}?action=flush&position=${data.byteLength}`, { method: 'PATCH' }, `flush ${file}`)
  return url
}

export async function downloadFile(cfg: FabricConfig, file: string): Promise<string> {
  const res = await call(cfg, fileUrl(cfg, file), { method: 'GET' }, `read ${file}`)
  return res.text()
}

export const describeTarget = (cfg: FabricConfig) => fileUrl(cfg, '').replace(/\/$/, '')
