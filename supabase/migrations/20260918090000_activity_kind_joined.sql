-- A new timeline kind for people joining an organisation. On its own: an enum value cannot be
-- used in the transaction that adds it, and the next migration uses it.
alter type public.activity_kind add value if not exists 'joined';
