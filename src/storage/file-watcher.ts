// File Watcher interface and implementation - Automatic cache invalidation

import * as fs from 'fs';
import * as path from 'path';

export interface FileWatcher {
  /**
   * Start watching for file changes
   */
  startWatching(directory: string): Promise<void>;

  /**
   * Stop watching for file changes
   */
  stopWatching(): Promise<void>;

  /**
   * Add a callback for file changes
   */
  onFileChange(callback: (filePath: string, eventType: 'created' | 'modified' | 'deleted') => void): void;

  /**
   * Add a callback for directory changes
   */
  onDirectoryChange(callback: (dirPath: string, eventType: 'created' | 'deleted') => void): void;

  /**
   * Check if currently watching
   */
  isWatching(): boolean;

  /**
   * Get watched directories
   */
  getWatchedDirectories(): string[];
}

type FileChangeCallback = (filePath: string, eventType: 'created' | 'modified' | 'deleted') => void;
type DirectoryChangeCallback = (dirPath: string, eventType: 'created' | 'deleted') => void;

export class NodeFileWatcher implements FileWatcher {
  private watchers: Map<string, fs.FSWatcher> = new Map();
  private fileChangeCallbacks: FileChangeCallback[] = [];
  private directoryChangeCallbacks: DirectoryChangeCallback[] = [];
  private watchedDirectories: Set<string> = new Set();

  /**
   * Start watching for file changes
   */
  async startWatching(directory: string): Promise<void> {
    const absolutePath = path.resolve(directory);

    // Check if directory exists
    try {
      const stats = await fs.promises.stat(absolutePath);
      if (!stats.isDirectory()) {
        throw new Error(`${absolutePath} is not a directory`);
      }
    } catch (error) {
      throw new Error(`Cannot watch directory ${absolutePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Don't watch the same directory twice
    if (this.watchers.has(absolutePath)) {
      return;
    }

    try {
      const watcher = fs.watch(absolutePath, { recursive: true }, (eventType, filename) => {
        if (!filename) return;

        const fullPath = path.join(absolutePath, filename);
        this.handleFileSystemEvent(fullPath, eventType);
      });

      this.watchers.set(absolutePath, watcher);
      this.watchedDirectories.add(absolutePath);

      // Handle watcher errors
      watcher.on('error', (error) => {
        console.error(`File watcher error for ${absolutePath}:`, error);
        this.watchers.delete(absolutePath);
        this.watchedDirectories.delete(absolutePath);
      });

    } catch (error) {
      throw new Error(`Failed to start watching ${absolutePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stop watching for file changes
   */
  async stopWatching(): Promise<void> {
    for (const [directory, watcher] of this.watchers) {
      try {
        watcher.close();
      } catch (error) {
        console.error(`Error closing watcher for ${directory}:`, error);
      }
    }

    this.watchers.clear();
    this.watchedDirectories.clear();
  }

  /**
   * Stop watching a specific directory
   */
  async stopWatchingDirectory(directory: string): Promise<void> {
    const absolutePath = path.resolve(directory);
    const watcher = this.watchers.get(absolutePath);

    if (watcher) {
      try {
        watcher.close();
        this.watchers.delete(absolutePath);
        this.watchedDirectories.delete(absolutePath);
      } catch (error) {
        console.error(`Error closing watcher for ${absolutePath}:`, error);
      }
    }
  }

  /**
   * Add a callback for file changes
   */
  onFileChange(callback: FileChangeCallback): void {
    this.fileChangeCallbacks.push(callback);
  }

  /**
   * Add a callback for directory changes
   */
  onDirectoryChange(callback: DirectoryChangeCallback): void {
    this.directoryChangeCallbacks.push(callback);
  }

  /**
   * Remove a file change callback
   */
  removeFileChangeCallback(callback: FileChangeCallback): void {
    const index = this.fileChangeCallbacks.indexOf(callback);
    if (index > -1) {
      this.fileChangeCallbacks.splice(index, 1);
    }
  }

  /**
   * Remove a directory change callback
   */
  removeDirectoryChangeCallback(callback: DirectoryChangeCallback): void {
    const index = this.directoryChangeCallbacks.indexOf(callback);
    if (index > -1) {
      this.directoryChangeCallbacks.splice(index, 1);
    }
  }

  /**
   * Check if currently watching
   */
  isWatching(): boolean {
    return this.watchers.size > 0;
  }

  /**
   * Get watched directories
   */
  getWatchedDirectories(): string[] {
    return Array.from(this.watchedDirectories);
  }

  /**
   * Handle file system events
   */
  private handleFileSystemEvent(fullPath: string, eventType: string): void {
    // Determine if this is a file or directory change
    fs.stat(fullPath, (err, stats) => {
      if (err) {
        // File was deleted or doesn't exist
        this.notifyFileChange(fullPath, 'deleted');
        return;
      }

      if (stats.isDirectory()) {
        // Directory event
        const dirEventType = eventType === 'rename' ? 'created' : 'created';
        this.notifyDirectoryChange(fullPath, dirEventType);
      } else {
        // File event
        let fileEventType: 'created' | 'modified' | 'deleted';
        
        switch (eventType) {
          case 'rename':
            fileEventType = 'created';
            break;
          case 'change':
            fileEventType = 'modified';
            break;
          default:
            fileEventType = 'modified';
        }

        this.notifyFileChange(fullPath, fileEventType);
      }
    });
  }

  /**
   * Notify file change callbacks
   */
  private notifyFileChange(filePath: string, eventType: 'created' | 'modified' | 'deleted'): void {
    for (const callback of this.fileChangeCallbacks) {
      try {
        callback(filePath, eventType);
      } catch (error) {
        console.error('Error in file change callback:', error);
      }
    }
  }

  /**
   * Notify directory change callbacks
   */
  private notifyDirectoryChange(dirPath: string, eventType: 'created' | 'deleted'): void {
    for (const callback of this.directoryChangeCallbacks) {
      try {
        callback(dirPath, eventType);
      } catch (error) {
        console.error('Error in directory change callback:', error);
      }
    }
  }
}