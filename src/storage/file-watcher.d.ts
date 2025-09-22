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
export declare class NodeFileWatcher implements FileWatcher {
    private watchers;
    private fileChangeCallbacks;
    private directoryChangeCallbacks;
    private watchedDirectories;
    /**
     * Start watching for file changes
     */
    startWatching(directory: string): Promise<void>;
    /**
     * Stop watching for file changes
     */
    stopWatching(): Promise<void>;
    /**
     * Stop watching a specific directory
     */
    stopWatchingDirectory(directory: string): Promise<void>;
    /**
     * Add a callback for file changes
     */
    onFileChange(callback: FileChangeCallback): void;
    /**
     * Add a callback for directory changes
     */
    onDirectoryChange(callback: DirectoryChangeCallback): void;
    /**
     * Remove a file change callback
     */
    removeFileChangeCallback(callback: FileChangeCallback): void;
    /**
     * Remove a directory change callback
     */
    removeDirectoryChangeCallback(callback: DirectoryChangeCallback): void;
    /**
     * Check if currently watching
     */
    isWatching(): boolean;
    /**
     * Get watched directories
     */
    getWatchedDirectories(): string[];
    /**
     * Handle file system events
     */
    private handleFileSystemEvent;
    /**
     * Notify file change callbacks
     */
    private notifyFileChange;
    /**
     * Notify directory change callbacks
     */
    private notifyDirectoryChange;
}
export {};
//# sourceMappingURL=file-watcher.d.ts.map