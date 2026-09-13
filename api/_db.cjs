const { neon } = require('@neondatabase/serverless');

const DATABASE_URL = process.env.DATABASE_URL || '';

exports.sql = neon(DATABASE_URL);

exports.initDB = async function initDB() {
  await exports.sql`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open'`;
  await exports.sql`ALTER TABLE polls ADD COLUMN IF NOT EXISTS question_image TEXT`;
  await exports.sql`ALTER TABLE polls ADD COLUMN IF NOT EXISTS launched_at TIMESTAMPTZ`;

  await exports.sql`
    CREATE TABLE IF NOT EXISTS rooms (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(6) UNIQUE NOT NULL,
      name TEXT NOT NULL,
      host_name TEXT NOT NULL,
      passcode TEXT,
      is_active BOOLEAN DEFAULT true,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `;

  await exports.sql`
    CREATE TABLE IF NOT EXISTS polls (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
      question TEXT NOT NULL,
      poll_type VARCHAR(20) DEFAULT 'single',
      options JSONB NOT NULL DEFAULT '[]',
      phase VARCHAR(20) DEFAULT 'voting_open',
      correct_answers INTEGER[] DEFAULT '{}',
      timer_seconds INTEGER,
      question_image TEXT,
      launched_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `;

  await exports.sql`
    CREATE TABLE IF NOT EXISTS votes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      poll_id UUID REFERENCES polls(id) ON DELETE CASCADE,
      session_id TEXT NOT NULL,
      selected_options INTEGER[] NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(poll_id, session_id)
    )
  `;

  await exports.sql`
    CREATE TABLE IF NOT EXISTS qa_posts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      display_name TEXT DEFAULT 'Anonymous',
      is_anonymous BOOLEAN DEFAULT false,
      upvotes INTEGER DEFAULT 0,
      is_pinned BOOLEAN DEFAULT false,
      is_answering BOOLEAN DEFAULT false,
      is_answered BOOLEAN DEFAULT false,
      is_hidden BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `;

  await exports.sql`
    CREATE TABLE IF NOT EXISTS word_clouds (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
      prompt TEXT NOT NULL,
      state VARCHAR(20) NOT NULL DEFAULT 'draft',
      launched_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `;

  await exports.sql`
    CREATE TABLE IF NOT EXISTS word_responses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      cloud_id UUID REFERENCES word_clouds(id) ON DELETE CASCADE,
      session_id TEXT NOT NULL,
      text TEXT NOT NULL,
      normalized_text TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(cloud_id, session_id, normalized_text)
    )
  `;
  await exports.sql`
    CREATE INDEX IF NOT EXISTS word_responses_cloud_created_idx
    ON word_responses(cloud_id, created_at DESC)
  `;

  await exports.sql`CREATE TABLE IF NOT EXISTS quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    active_index INT,
    created_at TIMESTAMPTZ DEFAULT now()
  )`;
  await exports.sql`ALTER TABLE polls ADD COLUMN IF NOT EXISTS quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE`;
  await exports.sql`ALTER TABLE polls ADD COLUMN IF NOT EXISTS order_index INT`;
await exports.sql`
    CREATE TABLE IF NOT EXISTS members (
      room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
      session_id TEXT NOT NULL,
      display_name TEXT DEFAULT 'Anonymous',
      last_seen TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY (room_id, session_id)
    )
  `;
};