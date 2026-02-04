// Direct test with explicit pool configuration
process.env.DATABASE_URL = 'postgresql://jbr_user:jbr_dev_password@localhost:5555/jualbeliraket';
process.env.BETTER_AUTH_SECRET = 'testsecret12345678901234567890123';

import { Pool } from 'pg';
import { betterAuth } from 'better-auth';
import bcrypt from 'bcryptjs';

const pool = new Pool({ 
    host: 'localhost',
    port: 5555,
    user: 'jbr_user',
    password: 'jbr_dev_password',
    database: 'jualbeliraket'
});

const auth = betterAuth({
    secret: process.env.BETTER_AUTH_SECRET,
    database: pool,
    emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
        password: {
            hash: async (password: string) => bcrypt.hash(password, 10),
            verify: async ({ hash, password }: { hash: string; password: string }) => bcrypt.compare(password, hash),
        },
    },
    user: { modelName: 'users', fields: { emailVerified: 'email_verified', createdAt: 'created_at', updatedAt: 'updated_at' } },
    session: { modelName: 'sessions', fields: { userId: 'user_id', expiresAt: 'expires_at', createdAt: 'created_at', updatedAt: 'updated_at', ipAddress: 'ip_address', userAgent: 'user_agent' } },
    account: { modelName: 'accounts', fields: { userId: 'user_id', accountId: 'account_id', providerId: 'provider_id', accessToken: 'access_token', refreshToken: 'refresh_token', accessTokenExpiresAt: 'access_token_expires_at', refreshTokenExpiresAt: 'refresh_token_expires_at', idToken: 'id_token', createdAt: 'created_at', updatedAt: 'updated_at' } },
    verification: { modelName: 'verifications', fields: { expiresAt: 'expires_at', createdAt: 'created_at', updatedAt: 'updated_at' } },
});

async function test() {
    console.log('Testing with explicit pool (port 5555)...');
    
    // First test pool directly
    try {
        const res = await pool.query('SELECT 1 as test');
        console.log('✅ Pool connection works:', res.rows[0]);
    } catch (e: any) {
        console.log('❌ Pool connection failed:', e.message);
        process.exit(1);
    }
    
    // Test sign-in
    console.log('\nTesting sign-in with buyer1@demo.com...');
    try {
        const result = await auth.api.signInEmail({
            body: { email: 'buyer1@demo.com', password: 'demo123' }
        });
        console.log('✅ SUCCESS:', result.user?.email);
    } catch (e: any) {
        console.log('❌ FAILED:', e.message);
        if (e.errors) {
            console.log('   Errors:', e.errors.map((err: any) => `${err.address}:${err.port}`).join(', '));
        }
    }
    
    await pool.end();
    process.exit(0);
}

test();
