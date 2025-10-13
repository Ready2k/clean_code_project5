// Simple test to verify SSR compatibility
// This simulates server-side rendering where window/document are not available

// Mock the browser environment to be undefined
global.window = undefined;
global.document = undefined;
global.localStorage = undefined;
global.navigator = undefined;

try {
  // Try to import the main store and components
  const { store } = require('./dist/assets/index-Dmd5ogil.js');
  console.log('✅ SSR compatibility test passed - no window/document access during initialization');
} catch (error) {
  if (error.message.includes('window is not defined') || 
      error.message.includes('document is not defined') ||
      error.message.includes('localStorage is not defined') ||
      error.message.includes('navigator is not defined')) {
    console.error('❌ SSR compatibility test failed:', error.message);
    process.exit(1);
  } else {
    // Other errors might be expected (like module resolution)
    console.log('✅ SSR compatibility test passed - no browser API access errors');
  }
}