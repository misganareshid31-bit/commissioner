# Commissioner real messaging setup

The project now has a real authenticated 1-to-1 messaging backend using Supabase.

## What it provides

- Persistent conversations and messages in Postgres.
- Private RLS policies so members can only read conversations they belong to.
- `start_conversation()` to create/reuse a 1-to-1 conversation.
- `list_my_conversations()` for inboxes, previews, unread counts and the other member's profile.
- `get_conversation_messages()` for thread history.
- `send_message()` for validated 1–4000 character messages.
- `mark_conversation_read()` for read receipts.
- Supabase Realtime on the `messages` table.
- Creator cards' **Message** button starts/opens a real conversation.

## Install

1. Open Supabase Dashboard → SQL Editor.
2. Run `supabase-messaging.sql` after the main `supabase-schema.sql`.
3. Make sure Realtime is enabled for the `messages` table. The migration adds it to `supabase_realtime` when needed.
4. Refresh the Commissioner site and sign in with two different accounts.
5. From account A, open Discover creators and press **Message** on a creator belonging to account B.
6. Send a message. Sign in as B in another browser/device and verify the message appears without refreshing.

## Security

The database, not the React UI, controls membership. Users cannot create a conversation with themselves, read another user's conversation, or send a message as another user through the RPCs.

Attachments, voice messages and campaign workspaces are intentionally still UI placeholders; text messaging is the completed backend feature in this migration.
