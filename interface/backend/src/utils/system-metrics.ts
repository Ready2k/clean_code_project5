import os from 'os';
import fs from 'fs/promises';
import { execSync } from 'child_process';
import { logger } from './logger.js';

export interface SystemMetrics {
  memory: {
    total: number;
    used: number;
    free: number;
    usage: number;
    available?: number;
  };
  cpu: {
    usage: number;
    loadAverage: number[];
    cores: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  network?: {
    bytesReceived: number;
    bytesSent: number;
  };
  container?: {
    id: string;
    name: string;
    memoryLimit?: number;
    cpuLimit?: number;
  };
}

export class SystemMetricsCollector {
  private isDocker = false;
  private containerId?: string;
  private lastCpuStats?: { total: number; idle: number; timestamp: number };

  constructor() {
    this.detectEnvironment();
  }

  /**
   * Detect if running in Docker container
   */
  private detectEnvironment(): void {
    try {
      // Check if we're in a Docker container
      const cgroupPath = '/proc/1/cgroup';
      const mountinfoPath = '/proc/1/mountinfo';
      
      // Method 1: Check cgroup
      try {
        const cgroup = require('fs').readFileSync(cgroupPath, 'utf8');
        if (cgroup.includes('docker') || cgroup.includes('containerd')) {
          this.isDocker = true;
          // Extract container ID from cgroup
          const match = cgroup.match(/docker\/([a-f0-9]{64})/);
          if (match) {
            this.containerId = match[1].substring(0, 12); // Short container ID
          }
        }
      } catch (error) {
        // Ignore error, try other methods
      }

      // Method 2: Check for .dockerenv file
      if (!this.isDocker) {
        try {
          require('fs').accessSync('/.dockerenv');
          this.isDocker = true;
        } catch (error) {
          // Not in Docker
        }
      }

      // Method 3: Check mountinfo for overlay filesystem
      if (!this.isDocker) {
        try {
          const mountinfo = require('fs').readFileSync(mountinfoPath, 'utf8');
          if (mountinfo.includes('overlay')) {
            this.isDocker = true;
          }
        } catch (error) {
          // Ignore error
        }
      }

      if (this.isDocker) {
        logger.info('Detected Docker container environment', { containerId: this.containerId });
      } else {
        logger.info('Detected host environment');
      }
    } catch (error) {
      logger.warn('Failed to detect environment:', error);
    }
  }

  /**
   * Collect comprehensive system metrics
   */
  async collectMetrics(): Promise<SystemMetrics> {
    try {
      const [memory, cpu, disk, network, container] = await Promise.all([
        this.getMemoryMetrics(),
        this.getCpuMetrics(),
        this.getDiskMetrics(),
        this.getNetworkMetrics().catch(() => undefined),
        this.getContainerMetrics().catch(() => undefined)
      ]);

      const result: SystemMetrics = {
        memory,
        cpu,
        disk
      };

      if (network) {
        result.network = network;
      }

      if (container) {
        result.container = container;
      }

      return result;
    } catch (error) {
      logger.error('Failed to collect system metrics:', error);
      throw error;
    }
  }

  /**
   * Get memory metrics
   */
  private async getMemoryMetrics(): Promise<SystemMetrics['memory']> {
    if (this.isDocker) {
      return this.getDockerMemoryMetrics();
    } else {
      return this.getHostMemoryMetrics();
    }
  }

  /**
   * Get host memory metrics
   */
  private getHostMemoryMetrics(): SystemMetrics['memory'] {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;

    return {
      total,
      used,
      free,
      usage: (used / total) * 100
    };
  }

  /**
   * Get Docker container memory metrics
   */
  private async getDockerMemoryMetrics(): Promise<SystemMetrics['memory']> {
    try {
      // Try to read from cgroup v2 first (newer Docker versions)
      const memoryCurrentPath = '/sys/fs/cgroup/memory.current';
      const memoryMaxPath = '/sys/fs/cgroup/memory.max';
      
      let used: number;
      let total: number;

      try {
        const currentBytes = await fs.readFile(memoryCurrentPath, 'utf8');
        const maxBytes = await fs.readFile(memoryMaxPath, 'utf8');
        
        used = parseInt(currentBytes.trim());
        total = parseInt(maxBytes.trim());
        
        // If max is "max", use system total memory
        if (isNaN(total) || total > os.totalmem()) {
          total = os.totalmem();
        }
      } catch (error) {
        // Fall back to cgroup v1
        const memoryUsagePath = '/sys/fs/cgroup/memory/memory.usage_in_bytes';
        const memoryLimitPath = '/sys/fs/cgroup/memory/memory.limit_in_bytes';
        
        try {
          const usageBytes = await fs.readFile(memoryUsagePath, 'utf8');
          const limitBytes = await fs.readFile(memoryLimitPath, 'utf8');
          
          used = parseInt(usageBytes.trim());
          total = parseInt(limitBytes.trim());
          
          // If limit is very high, use system total memory
          if (total > os.totalmem()) {
            total = os.totalmem();
          }
        } catch (cgroupError) {
          // Fall back to host metrics
          return this.getHostMemoryMetrics();
        }
      }

      const free = total - used;

      return {
        total,
        used,
        free,
        usage: (used / total) * 100
      };
    } catch (error) {
      logger.warn('Failed to get Docker memory metrics, falling back to host metrics:', error);
      return this.getHostMemoryMetrics();
    }
  }

  /**
   * Get CPU metrics
   */
  private async getCpuMetrics(): Promise<SystemMetrics['cpu']> {
    const cores = os.cpus().length;
    const loadAverage = os.loadavg();
    
    let usage: number;

    if (this.isDocker) {
      usage = await this.getDockerCpuUsage();
    } else {
      usage = await this.getHostCpuUsage();
    }

    return {
      usage,
      loadAverage,
      cores
    };
  }

  /**
   * Get host CPU usage
   */
  private async getHostCpuUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = process.hrtime();

      setTimeout(() => {
        const currentUsage = process.cpuUsage(startUsage);
        const currentTime = process.hrtime(startTime);

        const totalTime = currentTime[0] * 1000000 + currentTime[1] / 1000;
        const totalUsage = currentUsage.user + currentUsage.system;
        const cpuPercent = (totalUsage / totalTime) * 100;

        resolve(Math.min(100, Math.max(0, cpuPercent)));
      }, 100);
    });
  }

  /**
   * Get Docker container CPU usage
   */
  private async getDockerCpuUsage(): Promise<number> {
    try {
      // Try cgroup v2 first
      const cpuStatPath = '/sys/fs/cgroup/cpu.stat';
      
      try {
        const cpuStat = await fs.readFile(cpuStatPath, 'utf8');
        const usageMatch = cpuStat.match(/usage_usec (\d+)/);
        
        if (usageMatch && usageMatch[1]) {
          const currentUsage = parseInt(usageMatch[1]);
          const currentTime = Date.now();
          
          if (this.lastCpuStats) {
            const timeDiff = currentTime - this.lastCpuStats.timestamp;
            const usageDiff = currentUsage - this.lastCpuStats.total;
            
            // Convert microseconds to percentage
            const cpuPercent = (usageDiff / (timeDiff * 1000)) * 100;
            
            this.lastCpuStats = { total: currentUsage, idle: 0, timestamp: currentTime };
            return Math.min(100, Math.max(0, cpuPercent));
          } else {
            this.lastCpuStats = { total: currentUsage, idle: 0, timestamp: currentTime };
            return 0;
          }
        }
      } catch (error) {
        // Fall back to cgroup v1
        const cpuacctUsagePath = '/sys/fs/cgroup/cpuacct/cpuacct.usage';
        
        try {
          const usage = await fs.readFile(cpuacctUsagePath, 'utf8');
          const currentUsage = parseInt(usage.trim());
          const currentTime = Date.now();
          
          if (this.lastCpuStats) {
            const timeDiff = currentTime - this.lastCpuStats.timestamp;
            const usageDiff = currentUsage - this.lastCpuStats.total;
            
            // Convert nanoseconds to percentage
            const cpuPercent = (usageDiff / (timeDiff * 1000000)) * 100;
            
            this.lastCpuStats = { total: currentUsage, idle: 0, timestamp: currentTime };
            return Math.min(100, Math.max(0, cpuPercent));
          } else {
            this.lastCpuStats = { total: currentUsage, idle: 0, timestamp: currentTime };
            return 0;
          }
        } catch (cgroupError) {
          // Fall back to host CPU usage
          return this.getHostCpuUsage();
        }
      }
      
      return this.getHostCpuUsage();
    } catch (error) {
      logger.warn('Failed to get Docker CPU metrics, falling back to host metrics:', error);
      return this.getHostCpuUsage();
    }
  }

  /**
   * Get disk metrics
   */
  private async getDiskMetrics(): Promise<SystemMetrics['disk']> {
    try {
      // Use the data directory as the reference point
      const dataDir = process.env['DATA_DIR'] || process.cwd();
      
      if (this.isDocker) {
        return this.getDockerDiskMetrics(dataDir);
      } else {
        return this.getHostDiskMetrics(dataDir);
      }
    } catch (error) {
      logger.warn('Failed to get disk metrics:', error);
      // Return mock data as fallback
      return {
        total: 100 * 1024 * 1024 * 1024, // 100GB
        used: 45 * 1024 * 1024 * 1024,   // 45GB
        free: 55 * 1024 * 1024 * 1024,   // 55GB
        usage: 45
      };
    }
  }

  /**
   * Get host disk metrics
   */
  private async getHostDiskMetrics(path: string): Promise<SystemMetrics['disk']> {
    try {
      // Use df command to get disk usage (macOS compatible)
      const output = execSync(`df -k "${path}"`, { encoding: 'utf8' });
      const lines = output.trim().split('\n');
      
      if (lines.length >= 2 && lines[1]) {
        const parts = lines[1].split(/\s+/);
        // df -k returns values in 1K blocks, so multiply by 1024 to get bytes
        const total = parseInt(parts[1] || '0') * 1024;
        const used = parseInt(parts[2] || '0') * 1024;
        const free = parseInt(parts[3] || '0') * 1024;
        
        return {
          total,
          used,
          free,
          usage: total > 0 ? (used / total) * 100 : 0
        };
      }
    } catch (error) {
      logger.warn('Failed to get host disk metrics using df command:', error);
    }

    // Fallback to default values
    return {
      total: 100 * 1024 * 1024 * 1024, // 100GB default
      used: 45 * 1024 * 1024 * 1024,   // 45GB default
      free: 55 * 1024 * 1024 * 1024,   // 55GB default
      usage: 45
    };
  }

  /**
   * Get Docker container disk metrics
   */
  private async getDockerDiskMetrics(path: string): Promise<SystemMetrics['disk']> {
    // For Docker containers, we can still use df command or check overlay filesystem
    return this.getHostDiskMetrics(path);
  }

  /**
   * Get network metrics
   */
  private async getNetworkMetrics(): Promise<SystemMetrics['network'] | undefined> {
    try {
      if (this.isDocker) {
        return this.getDockerNetworkMetrics();
      } else {
        return this.getHostNetworkMetrics();
      }
    } catch (error) {
      logger.warn('Failed to get network metrics:', error);
      return undefined;
    }
  }

  /**
   * Get host network metrics
   */
  private async getHostNetworkMetrics(): Promise<SystemMetrics['network']> {
    try {
      const netdev = await fs.readFile('/proc/net/dev', 'utf8');
      const lines = netdev.split('\n');
      
      let totalReceived = 0;
      let totalSent = 0;
      
      for (const line of lines) {
        if (line.includes(':') && !line.includes('lo:')) { // Skip loopback
          const parts = line.split(/\s+/).filter(p => p.length > 0);
          if (parts.length >= 10) {
            totalReceived += parseInt(parts[1] || '0') || 0;
            totalSent += parseInt(parts[9] || '0') || 0;
          }
        }
      }
      
      return {
        bytesReceived: totalReceived,
        bytesSent: totalSent
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get Docker container network metrics
   */
  private async getDockerNetworkMetrics(): Promise<SystemMetrics['network']> {
    // For Docker containers, we can still read from /proc/net/dev
    return this.getHostNetworkMetrics();
  }

  /**
   * Get container-specific metrics
   */
  private async getContainerMetrics(): Promise<SystemMetrics['container'] | undefined> {
    if (!this.isDocker) {
      return undefined;
    }

    try {
      let containerName = 'unknown';
      
      // Try to get container name from hostname
      try {
        containerName = os.hostname();
      } catch (error) {
        // Use container ID if available
        containerName = this.containerId || 'unknown';
      }

      // Try to get memory limit
      let memoryLimit: number | undefined;
      try {
        const limitPath = '/sys/fs/cgroup/memory.max';
        const limitBytes = await fs.readFile(limitPath, 'utf8');
        const limit = parseInt(limitBytes.trim());
        if (!isNaN(limit) && limit < os.totalmem()) {
          memoryLimit = limit;
        }
      } catch (error) {
        // Try cgroup v1
        try {
          const limitPath = '/sys/fs/cgroup/memory/memory.limit_in_bytes';
          const limitBytes = await fs.readFile(limitPath, 'utf8');
          const limit = parseInt(limitBytes.trim());
          if (!isNaN(limit) && limit < os.totalmem()) {
            memoryLimit = limit;
          }
        } catch (cgroupError) {
          // No memory limit set
        }
      }

      const result: SystemMetrics['container'] = {
        id: this.containerId || 'unknown',
        name: containerName
      };

      if (memoryLimit !== undefined) {
        result.memoryLimit = memoryLimit;
      }

      return result;
    } catch (error) {
      logger.warn('Failed to get container metrics:', error);
      return undefined;
    }
  }

  /**
   * Check if running in Docker
   */
  isRunningInDocker(): boolean {
    return this.isDocker;
  }

  /**
   * Get container ID if available
   */
  getContainerId(): string | undefined {
    return this.containerId;
  }
}

// Singleton instance
let systemMetricsCollector: SystemMetricsCollector | null = null;

export function getSystemMetricsCollector(): SystemMetricsCollector {
  if (!systemMetricsCollector) {
    systemMetricsCollector = new SystemMetricsCollector();
  }
  return systemMetricsCollector;
}