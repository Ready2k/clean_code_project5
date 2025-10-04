#!/usr/bin/env tsx

/**
 * Test script for system metrics collection
 * This script tests the system metrics collector to ensure it's working properly
 */

import { getSystemMetricsCollector } from '../utils/system-metrics.js';


async function testSystemMetrics() {
  console.log('🔍 Testing System Metrics Collection...\n');

  try {
    const collector = getSystemMetricsCollector();
    
    console.log('📊 Environment Detection:');
    console.log(`- Running in Docker: ${collector.isRunningInDocker()}`);
    console.log(`- Container ID: ${collector.getContainerId() || 'N/A'}\n`);

    console.log('📈 Collecting system metrics...');
    const metrics = await collector.collectMetrics();

    console.log('\n💾 Memory Metrics:');
    console.log(`- Total: ${formatBytes(metrics.memory.total)}`);
    console.log(`- Used: ${formatBytes(metrics.memory.used)} (${metrics.memory.usage.toFixed(1)}%)`);
    console.log(`- Free: ${formatBytes(metrics.memory.free)}`);

    console.log('\n🖥️  CPU Metrics:');
    console.log(`- Usage: ${metrics.cpu.usage.toFixed(1)}%`);
    console.log(`- Cores: ${metrics.cpu.cores}`);
    console.log(`- Load Average: [${metrics.cpu.loadAverage.map(l => l.toFixed(2)).join(', ')}]`);

    console.log('\n💿 Disk Metrics:');
    console.log(`- Total: ${formatBytes(metrics.disk.total)}`);
    console.log(`- Used: ${formatBytes(metrics.disk.used)} (${metrics.disk.usage.toFixed(1)}%)`);
    console.log(`- Free: ${formatBytes(metrics.disk.free)}`);

    if (metrics.network) {
      console.log('\n🌐 Network Metrics:');
      console.log(`- Bytes Received: ${formatBytes(metrics.network.bytesReceived)}`);
      console.log(`- Bytes Sent: ${formatBytes(metrics.network.bytesSent)}`);
    }

    if (metrics.container) {
      console.log('\n🐳 Container Metrics:');
      console.log(`- Container ID: ${metrics.container.id}`);
      console.log(`- Container Name: ${metrics.container.name}`);
      if (metrics.container.memoryLimit) {
        console.log(`- Memory Limit: ${formatBytes(metrics.container.memoryLimit)}`);
      }
    }

    console.log('\n✅ System metrics collection test completed successfully!');

    // Test multiple collections to verify CPU usage calculation
    console.log('\n🔄 Testing multiple collections for CPU usage accuracy...');
    for (let i = 1; i <= 3; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      const newMetrics = await collector.collectMetrics();
      console.log(`Collection ${i}: CPU Usage = ${newMetrics.cpu.usage.toFixed(1)}%`);
    }

  } catch (error) {
    console.error('❌ Error testing system metrics:', error);
    process.exit(1);
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Run the test
testSystemMetrics().catch(console.error);