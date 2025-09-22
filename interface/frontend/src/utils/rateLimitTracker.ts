class RateLimitTracker {
  private rateLimitedUntil: Map<string, number> = new Map();

  isRateLimited(endpoint: string): boolean {
    const until = this.rateLimitedUntil.get(endpoint);
    if (!until) return false;
    
    if (Date.now() > until) {
      this.rateLimitedUntil.delete(endpoint);
      return false;
    }
    
    return true;
  }

  setRateLimited(endpoint: string, durationMs: number = 60000): void {
    const until = Date.now() + durationMs;
    this.rateLimitedUntil.set(endpoint, until);
    console.log(`Rate limited for ${endpoint} until ${new Date(until).toLocaleTimeString()}`);
  }

  getRateLimitedEndpoints(): string[] {
    const now = Date.now();
    const active: string[] = [];
    
    for (const [endpoint, until] of this.rateLimitedUntil.entries()) {
      if (now <= until) {
        active.push(endpoint);
      } else {
        this.rateLimitedUntil.delete(endpoint);
      }
    }
    
    return active;
  }

  clear(): void {
    this.rateLimitedUntil.clear();
  }
}

export const rateLimitTracker = new RateLimitTracker();