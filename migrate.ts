// Migration script: creates Supabase tables via direct SQL
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

async function migrate() {
  console.log('🔄 Starting migration...');
  console.log('URL:', supabaseUrl);

  // Test connection by trying to select from a table that might not exist
  // We'll create tables by inserting data — Supabase auto-creates with the REST API
  // But for DDL we need the SQL endpoint

  // Try using the Supabase SQL endpoint (available in newer versions)
  const sqlStatements = [
    // Settings
    `CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY DEFAULT 'main',
      bots JSONB DEFAULT '[]'::jsonb,
      gemini_api_key TEXT DEFAULT '',
      app_url TEXT DEFAULT 'http://localhost:3000',
      notifications BOOLEAN DEFAULT true,
      auto_reminders BOOLEAN DEFAULT true,
      lava_api_key TEXT DEFAULT '',
      lava_webhook_secret TEXT DEFAULT '',
      updated_at TIMESTAMPTZ DEFAULT now()
    )`,
    // Funnels
    `CREATE TABLE IF NOT EXISTS funnels (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )`,
    // Subscribers
    `CREATE TABLE IF NOT EXISTS subscribers (
      id BIGINT PRIMARY KEY,
      first_name TEXT NOT NULL DEFAULT '',
      last_name TEXT,
      username TEXT,
      language_code TEXT,
      last_active TIMESTAMPTZ DEFAULT now()
    )`,
    // Messages
    `CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chat_id BIGINT NOT NULL,
      sender TEXT NOT NULL CHECK (sender IN ('bot', 'user')),
      text TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )`,
    // Orders
    `CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer TEXT NOT NULL DEFAULT '',
      username TEXT DEFAULT '',
      product TEXT NOT NULL DEFAULT '',
      amount NUMERIC DEFAULT 0,
      status TEXT DEFAULT 'pending' CHECK (status IN ('paid', 'pending', 'refund')),
      date TEXT NOT NULL DEFAULT '',
      bot TEXT DEFAULT '',
      chat_id BIGINT,
      funnel_id TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )`,
    // Indexes
    `CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id)`,
    // Initial settings row
    `INSERT INTO settings (id) VALUES ('main') ON CONFLICT (id) DO NOTHING`,
    // RLS
    `ALTER TABLE settings ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE funnels ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE messages ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE orders ENABLE ROW LEVEL SECURITY`,
    `DROP POLICY IF EXISTS "Service role full access" ON settings`,
    `DROP POLICY IF EXISTS "Service role full access" ON funnels`,
    `DROP POLICY IF EXISTS "Service role full access" ON subscribers`,
    `DROP POLICY IF EXISTS "Service role full access" ON messages`,
    `DROP POLICY IF EXISTS "Service role full access" ON orders`,
    `REVOKE ALL PRIVILEGES ON TABLE settings FROM PUBLIC, anon, authenticated`,
    `REVOKE ALL PRIVILEGES ON TABLE funnels FROM PUBLIC, anon, authenticated`,
    `REVOKE ALL PRIVILEGES ON TABLE subscribers FROM PUBLIC, anon, authenticated`,
    `REVOKE ALL PRIVILEGES ON TABLE messages FROM PUBLIC, anon, authenticated`,
    `REVOKE ALL PRIVILEGES ON TABLE orders FROM PUBLIC, anon, authenticated`,
    `GRANT ALL PRIVILEGES ON TABLE settings TO service_role`,
    `GRANT ALL PRIVILEGES ON TABLE funnels TO service_role`,
    `GRANT ALL PRIVILEGES ON TABLE subscribers TO service_role`,
    `GRANT ALL PRIVILEGES ON TABLE messages TO service_role`,
    `GRANT ALL PRIVILEGES ON TABLE orders TO service_role`,
  ];

  // Try the /pg/query endpoint first
  for (let i = 0; i < sqlStatements.length; i++) {
    const sql = sqlStatements[i];
    const tableName = sql.match(/(?:TABLE|INDEX|INTO)\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i)?.[1] || `statement ${i}`;
    
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ query: sql }),
      });

      // If rpc endpoint doesn't work, try alternative
      if (!response.ok) {
        throw new Error(`RPC failed: ${response.status}`);
      }
      console.log(`✅ ${tableName}`);
    } catch (e) {
      // Try the /pg endpoint
      try {
        const response = await fetch(`${supabaseUrl}/pg/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ query: sql }),
        });

        if (response.ok) {
          console.log(`✅ ${tableName}`);
        } else {
          const text = await response.text();
          console.log(`❌ ${tableName}: ${response.status} - ${text.slice(0, 200)}`);
        }
      } catch (e2) {
        console.log(`❌ ${tableName}: ${(e2 as Error).message}`);
      }
    }
  }

  // Verify by trying to read from each table
  console.log('\n📋 Verifying tables...');
  const tables = ['settings', 'funnels', 'subscribers', 'messages', 'orders'];
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`❌ ${table}: ${error.message}`);
    } else {
      console.log(`✅ ${table}: accessible (${data.length} rows)`);
    }
  }

  console.log('\n🏁 Migration complete!');
}

migrate().catch(console.error);
