import 'dotenv/config';
import { Agent, setGlobalDispatcher } from 'undici';
import { neon } from '@neondatabase/serverless';

setGlobalDispatcher(new Agent({ connect: { family: 4 } }));

const sql = neon(process.env.DATABASE_URL);

await sql`CREATE TABLE IF NOT EXISTS rooms (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), code VARCHAR(6) UNIQUE NOT NULL, name TEXT NOT NULL, host_name TEXT NOT NULL, passcode TEXT, is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now())`;
await sql`CREATE TABLE IF NOT EXISTS polls (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), room_id UUID REFERENCES rooms(id) ON DELETE CASCADE, question TEXT NOT NULL, poll_type VARCHAR(20) DEFAULT 'single', options JSONB NOT NULL DEFAULT '[]', phase VARCHAR(20) DEFAULT 'voting_open', correct_answers INTEGER[] DEFAULT '{}', timer_seconds INTEGER, created_at TIMESTAMPTZ DEFAULT now())`;
await sql`CREATE TABLE IF NOT EXISTS votes (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), poll_id UUID REFERENCES polls(id) ON DELETE CASCADE, session_id TEXT NOT NULL, selected_options INTEGER[] NOT NULL, created_at TIMESTAMPTZ DEFAULT now(), UNIQUE(poll_id, session_id))`;
await sql`CREATE TABLE IF NOT EXISTS qa_posts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), room_id UUID REFERENCES rooms(id) ON DELETE CASCADE, content TEXT NOT NULL, display_name TEXT DEFAULT 'Anonymous', is_anonymous BOOLEAN DEFAULT false, upvotes INTEGER DEFAULT 0, is_pinned BOOLEAN DEFAULT false, is_answering BOOLEAN DEFAULT false, is_answered BOOLEAN DEFAULT false, is_hidden BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT now())`;

const t = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`;
console.log('DB ready. Tables:', t.map(r => r.table_name).join(', '));