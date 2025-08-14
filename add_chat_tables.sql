CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    title TEXT,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL,
    CONSTRAINT chat_sessions_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    content TEXT NOT NULL,
    sender TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'text',
    metadata JSONB,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT messages_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS chat_sessions_customer_id_updated_at_idx ON chat_sessions(customer_id, updated_at);

CREATE INDEX IF NOT EXISTS messages_session_id_created_at_idx ON messages(session_id, created_at);

ALTER TABLE chat_sessions ADD CONSTRAINT chat_sessions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(phone) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE messages ADD CONSTRAINT messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE ON UPDATE CASCADE;