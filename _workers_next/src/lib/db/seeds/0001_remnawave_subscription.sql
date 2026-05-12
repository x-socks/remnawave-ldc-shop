-- price is required by the upstream product model, but this product computes
-- the payable amount from tier/months at checkout time.
INSERT OR IGNORE INTO products (
    id,
    name,
    type,
    description,
    price,
    category,
    is_active,
    is_shared,
    stock_count,
    sort_order
) VALUES (
    'remnawave_subscription',
    'Remnawave Subscription',
    'remnawave_subscription',
    'Pay-as-you-go monthly Remnawave VPN subscription.',
    '0',
    'subscription',
    1,
    1,
    NULL,
    0
);
