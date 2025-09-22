#!/usr/bin/env node

const axios = require('axios');

const API_BASE = 'http://localhost:8000/api';

async function testBackend() {
  console.log('🧪 Testing backend API...\n');

  try {
    // Test health check
    console.log('1. Testing health check...');
    const healthResponse = await axios.get(`${API_BASE}/health`);
    console.log('✅ Health check:', healthResponse.data);

    // Test login with default admin
    console.log('\n2. Testing login...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'admin@example.com',
      password: 'admin123456'
    });
    console.log('✅ Login successful:', {
      user: loginResponse.data.data.user.username,
      token: loginResponse.data.data.token ? 'present' : 'missing'
    });

    // Test authenticated endpoint
    console.log('\n3. Testing authenticated endpoint...');
    const token = loginResponse.data.data.token;
    const meResponse = await axios.get(`${API_BASE}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    console.log('✅ Current user:', {
      username: meResponse.data.data.username,
      email: meResponse.data.data.email,
      role: meResponse.data.data.role
    });

    console.log('\n🎉 All tests passed! Backend is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    process.exit(1);
  }
}

testBackend();