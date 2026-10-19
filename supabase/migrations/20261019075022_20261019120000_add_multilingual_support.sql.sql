/*
# Add Multilingual AI Support

## Changes

### 1. user_preferences table — add preferred_language column
- New column `preferred_language` (text, default 'automatic')
- Stores the user's AI response language preference:
  - 'automatic' = respond in the language detected from each message
  - 'en' = English, 'rw' = Kinyarwanda, 'fr' = French, 'sw' = Kiswahili

### 2. New table: chat_messages
Stores AI coach conversation history with language metadata.
- Stores original user messages unchanged
- Stores AI responses in the response language
- Stores detected language and detection confidence
- Stores the internal English translation separately (for debugging/context)
- Owner-scoped with RLS (TO authenticated, auth.uid() = user_id)

## Security
- RLS enabled on chat_messages
- 4 owner-scoped policies (SELECT/INSERT/UPDATE/DELETE)
- user_id defaults to auth.uid()
- No translation API keys stored in the database — those live in backend env vars only
*/

-- 1. Add preferred_language to user_preferences
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'automatic'
  CHECK (preferred_language IN ('automatic', 'en', 'rw', 'fr', 'sw'));

-- 2. Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  detected_language text,
  detection_confidence float DEFAULT 0,
  response_language text,
  english_translation text,
  translation_used boolean DEFAULT false,
  translation_error text,
  source text DEFAULT 'ollama',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_chat_messages" ON chat_messages;
CREATE POLICY "select_own_chat_messages" ON chat_messages FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_chat_messages" ON chat_messages;
CREATE POLICY "insert_own_chat_messages" ON chat_messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_chat_messages" ON chat_messages;
CREATE POLICY "update_own_chat_messages" ON chat_messages FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_chat_messages" ON chat_messages;
CREATE POLICY "delete_own_chat_messages" ON chat_messages FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created ON chat_messages(user_id, created_at DESC);
