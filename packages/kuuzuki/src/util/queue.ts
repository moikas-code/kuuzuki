export class AsyncQueue<T> implements AsyncIterable<T> {
  private queue: T[] = [];
  private resolvers: ((value: T) => void)[] = [];
  private closed = false;

  push(item: T) {
    if (this.closed) return;
    const resolve = this.resolvers.shift();
    if (resolve) resolve(item);
    else this.queue.push(item);
  }

  async next(): Promise<T> {
    if (this.closed) throw new Error("Queue is closed");
    if (this.queue.length > 0) return this.queue.shift()!;
    return new Promise((resolve, reject) => {
      if (this.closed) {
        reject(new Error("Queue is closed"));
        return;
      }
      this.resolvers.push(resolve);

      // Add timeout to prevent hanging resolvers
      setTimeout(() => {
        const index = this.resolvers.indexOf(resolve);
        if (index >= 0) {
          this.resolvers.splice(index, 1);
          reject(new Error("Queue timeout"));
        }
      }, 30000); // 30 second timeout
    });
  }

  close() {
    this.closed = true;
    // Reject all pending resolvers
    for (const resolve of this.resolvers) {
      try {
        resolve(null as any); // This will cause the consumer to handle null
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
    this.resolvers.length = 0;
    this.queue.length = 0;
  }

  get size() {
    return this.queue.length + this.resolvers.length;
  }

  async *[Symbol.asyncIterator]() {
    while (!this.closed) {
      try {
        yield await this.next();
      } catch (error) {
        if (this.closed) break;
        throw error;
      }
    }
  }
}
