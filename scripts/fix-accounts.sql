-- Insert accounts for demo users with bcrypt hashed password for 'demo123'
INSERT INTO accounts (id, user_id, account_id, provider_id, password, created_at, updated_at)
SELECT 
    gen_random_uuid()::text, 
    u.id, 
    u.id, 
    'credential', 
    '$2b$10$oMhUb3DlK6zH0ottyME4peEm.25WdKYKj6nRbhdnneS.xX7C.DXou', 
    NOW(), 
    NOW() 
FROM users u 
WHERE u.email LIKE '%@demo.com'
AND NOT EXISTS (SELECT 1 FROM accounts a WHERE a.user_id = u.id AND a.provider_id = 'credential');
