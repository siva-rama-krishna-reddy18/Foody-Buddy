-- Run this SQL in your PostgreSQL database
-- Migration: Add enhanced chatbot features

-- 1. Customer Preferences (links to your existing customers table)
CREATE TABLE IF NOT EXISTS customer_preferences (
    phone VARCHAR(20) PRIMARY KEY,
    preferences JSONB DEFAULT '{}',
    dietary_restrictions TEXT[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (phone) REFERENCES customers(phone) ON DELETE CASCADE
);

-- 2. Shopping Carts (uses session_id like your chat_sessions)
CREATE TABLE IF NOT EXISTS shopping_carts (
    session_id VARCHAR(255) PRIMARY KEY,
    customer_phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_phone) REFERENCES customers(phone) ON DELETE SET NULL
);

-- 3. Cart Items (links to your products table)
CREATE TABLE IF NOT EXISTS cart_items (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    product_id VARCHAR(100) NOT NULL,
    quantity INTEGER DEFAULT 1,
    customizations JSONB DEFAULT '{}',
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES shopping_carts(session_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE(session_id, product_id)
);

-- 4. Order Status History (extends your orders table)
CREATE TABLE IF NOT EXISTS order_status_history (
    id SERIAL PRIMARY KEY,
    order_number INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL,
    notes TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_number) REFERENCES orders(order_number) ON DELETE CASCADE
);

-- 5. Enhanced Customer Interactions (for learning)
CREATE TABLE IF NOT EXISTS customer_interactions (
    id SERIAL PRIMARY KEY,
    customer_phone VARCHAR(20) NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    intent VARCHAR(100),
    entities JSONB DEFAULT '{}',
    response TEXT,
    products_shown JSONB DEFAULT '[]',
    satisfaction_score INTEGER CHECK (satisfaction_score >= 1 AND satisfaction_score <= 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_phone) REFERENCES customers(phone) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_preferences_phone ON customer_preferences(phone);
CREATE INDEX IF NOT EXISTS idx_shopping_carts_customer_phone ON shopping_carts(customer_phone);
CREATE INDEX IF NOT EXISTS idx_cart_items_session_id ON cart_items(session_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_number ON order_status_history(order_number);
CREATE INDEX IF NOT EXISTS idx_customer_interactions_customer_phone ON customer_interactions(customer_phone);
CREATE INDEX IF NOT EXISTS idx_customer_interactions_intent ON customer_interactions(intent);

-- Sample data for testing
INSERT INTO customer_preferences (phone, preferences, dietary_restrictions) 
VALUES ('+1234567890', '{"liked": ["biryani", "spicy"], "disliked": ["sweet"]}', ARRAY['vegetarian'])
ON CONFLICT (phone) DO NOTHING;