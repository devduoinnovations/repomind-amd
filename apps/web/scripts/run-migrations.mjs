#!/usr/bin/env node
/**
 * RepoMind Supabase Migration Runner
 *
 * Usage:
 *   SUPABASE_DB_PASSWORD=yourpassword node scripts/run-migrations.mjs
 *
 * Find your DB password: Supabase Dashboard → Settings → Database → Connection string
 * Copy the password from: postgresql://postgres:[PASSWORD]@...
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hzjpimprlnmzjmlpduyq.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6anBpbXBybG5temptbHBkdXlxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTgzNDYyOCwiZXhwIjoyMDkxNDEwNjI4fQ.aA3CoXehDZyVe7kQvoCll6MnxEz_pn8Kuvz7r72l1eg'
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD

// Extract project ref from URL
const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]

if (!DB_PASSWORD) {
  console.error(`
ERROR: SUPABASE_DB_PASSWORD not set.

1. Go to: https://supabase.com/dashboard/project/${projectRef}/settings/database
2. Copy the password from the "Connection string" section
3. Run: SUPABASE_DB_PASSWORD=yourpassword node scripts/run-migrations.mjs
`)
  process.exit(1)
}

// Use pg to connect directly
const { default: pg } = await import('pg').catch(() => {
  console.error('pg package not found. Installing...')
  return null
})

if (!pg) {
  // Try installing pg
  const { execSync } = await import('child_process')
  try {
    execSync('npm install --no-save pg', { stdio: 'inherit', cwd: join(__dirname, '..') })
    const { default: pgRetry } = await import('pg')
    await runMigrations(pgRetry)
  } catch (e) {
    console.error('Could not install pg:', e.message)
    process.exit(1)
  }
} else {
  await runMigrations(pg)
}

async function runMigrations(pg) {
  const { Client } = pg

  // Supabase direct connection (session mode pooler)
  const connectionString = `postgresql://postgres.${projectRef}:${DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require`

  const client = new Client({ connectionString })

  try {
    await client.connect()
    console.log('✓ Connected to Supabase database\n')
  } catch (err) {
    // Try direct connection
    try {
      const directUrl = `postgresql://postgres:${DB_PASSWORD}@db.${projectRef}.supabase.co:5432/postgres?sslmode=require`
      const client2 = new Client({ connectionString: directUrl })
      await client2.connect()
      console.log('✓ Connected via direct URL\n')
      await executeMigrations(client2)
      await client2.end()
      return
    } catch (err2) {
      console.error('Connection failed:', err.message)
      console.error('Also tried direct:', err2.message)
      console.error('\nCheck your password at: https://supabase.com/dashboard/project/' + projectRef + '/settings/database')
      process.exit(1)
    }
  }

  await executeMigrations(client)
  await client.end()
}

async function executeMigrations(client) {
  const migrations = [
    '20260429_initial_schema.sql',
    '20260430_releases.sql',
    '20260502_teams.sql',
    '20260503_user_agent_configs.sql',
  ]

  for (const file of migrations) {
    const filePath = join(__dirname, '..', 'supabase', 'migrations', file)
    let sql
    try {
      sql = readFileSync(filePath, 'utf8')
    } catch {
      console.log(`⚠ Skipping ${file} (not found)`)
      continue
    }

    // Split on semicolons, filter empty
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    console.log(`Running ${file} (${statements.length} statements)...`)
    let ok = 0, skipped = 0

    for (const stmt of statements) {
      try {
        await client.query(stmt)
        ok++
      } catch (err) {
        if (err.message.includes('already exists') || err.message.includes('duplicate')) {
          skipped++
        } else {
          console.error(`  ✗ ${err.message.slice(0, 100)}`)
        }
      }
    }
    console.log(`  ✓ ${ok} ok, ${skipped} already existed\n`)
  }

  console.log('✅ All migrations complete')
}
