// Test auth API
async function testAuth() {
    try {
        console.log('Testing sign-in API...');
        const response = await fetch('http://localhost:3000/api/auth/sign-in/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'buyer1@demo.com', password: 'demo123' })
        });
        
        console.log('Status:', response.status);
        console.log('Headers:', Object.fromEntries(response.headers.entries()));
        
        const text = await response.text();
        console.log('Response:', text);
        
        if (response.ok) {
            console.log('✅ Login successful!');
        } else {
            console.log('❌ Login failed');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

testAuth();
