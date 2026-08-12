import fs from 'node:fs'
import path from 'node:path'
import { Pool } from 'pg'

function loadProjectEnv() {
  if (process.env.POSTGRES_URL) return

  // The project currently keeps its local environment file under app/.
  // Next.js only auto-loads .env.local from the project root, so load the
  // server-only connection value here as a compatibility bridge.
  const envPath = path.join(process.cwd(), 'app', '.env.local')
  if (!fs.existsSync(envPath)) return

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)=(.*)\s*$/)
    if (!match) continue

    const value = match[2].trim().replace(/^['"]|['"]$/g, '')
    if (match[1] === 'POSTGRES_URL' && value) {
      process.env.POSTGRES_URL = value
      return
    }
  }
}

loadProjectEnv()

function normalizeConnectionString(connectionString?: string) {
  if (!connectionString) {
    return undefined
  }

  try {
    const url = new URL(connectionString)
    const sslMode = url.searchParams.get('sslmode')

    // Preserve today's stricter behavior and silence the pg warning.
    if (sslMode && ['prefer', 'require', 'verify-ca'].includes(sslMode)) {
      url.searchParams.set('sslmode', 'verify-full')
    }

    return url.toString()
  } catch {
    return connectionString
  }
}

const connectionString = normalizeConnectionString(process.env.POSTGRES_URL)

if (!connectionString) {
  throw new Error('POSTGRES_URL is not configured. Add it to .env.local or app/.env.local.')
}

export const pool = new Pool({ connectionString })
