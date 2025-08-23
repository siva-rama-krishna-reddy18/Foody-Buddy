-- CreateTable
CREATE TABLE "public"."customers" (
    "phone" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100),
    "email" VARCHAR(100),
    "city" VARCHAR(50),
    "country" VARCHAR(50),
    "line1" VARCHAR(100),
    "line2" VARCHAR(100),
    "postal_code" VARCHAR(20),
    "state" VARCHAR(50),
    "updated_at" TIMESTAMP(6),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("phone")
);

-- CreateTable
CREATE TABLE "public"."products" (
    "id" VARCHAR(100) NOT NULL,
    "name" VARCHAR(100),
    "description" TEXT,
    "price" DECIMAL,
    "category" VARCHAR(50),
    "available_days" TEXT[],
    "ingredients" TEXT[],
    "groups" TEXT[],

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."orders" (
    "order_number" INTEGER NOT NULL,
    "order_number_provisional" INTEGER,
    "amount" DECIMAL,
    "amount_paid" DECIMAL,
    "event_payment" DECIMAL,
    "created_at" TIMESTAMP(6),
    "payment_method" VARCHAR(50),
    "status" VARCHAR(50),
    "stripe_payment_intent" VARCHAR(100),
    "currency" VARCHAR(10),
    "group_id" VARCHAR(100),
    "coupon_id" TEXT,
    "customer_id" TEXT,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("order_number")
);

-- CreateTable
CREATE TABLE "public"."order_line_items" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER,
    "product_id" VARCHAR(100),
    "product_name" VARCHAR(100),
    "price" DECIMAL,
    "quantity" INTEGER,
    "date" DATE,
    "group_id" TEXT,
    "preference" VARCHAR(100),
    "special_instructions" TEXT,
    "tax_rates" TEXT,
    "type" VARCHAR(50),

    CONSTRAINT "order_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."coupons" (
    "id" VARCHAR(100) NOT NULL,
    "name" VARCHAR(100),
    "type" VARCHAR(50),
    "value" DECIMAL,
    "date" DATE,
    "group_id" VARCHAR(100),

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."chat_sessions" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "title" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."messages" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "message_type" TEXT NOT NULL DEFAULT 'text',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_sessions_customer_id_updated_at_idx" ON "public"."chat_sessions"("customer_id", "updated_at");

-- CreateIndex
CREATE INDEX "messages_session_id_created_at_idx" ON "public"."messages"("session_id", "created_at");

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("phone") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."order_line_items" ADD CONSTRAINT "order_line_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("order_number") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."chat_sessions" ADD CONSTRAINT "chat_sessions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("phone") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
