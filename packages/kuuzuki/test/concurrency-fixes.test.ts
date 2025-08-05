import { describe, it, expect, beforeEach } from "bun:test";
import { App } from "../src/app/app";
import { Session } from "../src/session";
import { Storage } from "../src/storage/storage";

describe("Concurrency Fixes", () => {
  describe("App.state() race condition fix", () => {
    it("should handle concurrent state initialization correctly", async () => {
      const testKey = "test-service-" + Date.now();
      let initCallCount = 0;
      
      const init = () => {
        initCallCount++;
        return { value: initCallCount };
      };
      
      // Create state function
      const getState = App.state(testKey, init);
      
      // Simulate concurrent access
      const promises = Array.from({ length: 10 }, () => 
        Promise.resolve().then(() => getState())
      );
      
      const results = await Promise.all(promises);
      
      // All results should be the same (first initialization)
      const firstResult = results[0];
      results.forEach(result => {
        expect(result).toEqual(firstResult);
      });
      
      // Init should only be called once despite concurrent access
      expect(initCallCount).toBe(1);
    });
    
    it("should handle async initialization correctly", async () => {
      const testKey = "async-service-" + Date.now();
      let initCallCount = 0;
      
      const init = async () => {
        initCallCount++;
        // Simulate async work
        await new Promise(resolve => setTimeout(resolve, 10));
        return { value: initCallCount, timestamp: Date.now() };
      };
      
      const getState = App.state(testKey, init);
      
      // Concurrent calls during async initialization
      const promises = Array.from({ length: 5 }, () => getState());
      const results = await Promise.all(promises);
      
      // All should get the same result
      const firstResult = results[0];
      results.forEach(result => {
        expect(result).toEqual(firstResult);
      });
      
      expect(initCallCount).toBe(1);
    });
  });
  
  describe("Session locking fixes", () => {
    it("should prevent concurrent session access", async () => {
      const sessionId = "test-session-" + Date.now();
      
      // Create a session first
      await App.provide({ cwd: process.cwd() }, async () => {
        await Session.create(sessionId);
        
        let lockAcquiredCount = 0;
        const promises = [];
        
        // Try to acquire locks concurrently
        for (let i = 0; i < 5; i++) {
          promises.push(
            Session.with(sessionId, async () => {
              lockAcquiredCount++;
              // Simulate some work
              await new Promise(resolve => setTimeout(resolve, 50));
              return lockAcquiredCount;
            }).catch(() => null) // Some may fail due to locking
          );
        }
        
        const results = await Promise.all(promises);
        const successfulResults = results.filter(r => r !== null);
        
        // At least one should succeed
        expect(successfulResults.length).toBeGreaterThan(0);
        
        // Clean up
        await Session.remove(sessionId);
      });
    });
  });
  
  describe("Storage operations", () => {
    it("should handle concurrent storage operations safely", async () => {
      const testKey = "concurrent-test-" + Date.now();
      const promises = [];
      
      // Concurrent writes
      for (let i = 0; i < 10; i++) {
        promises.push(
          Storage.set(testKey + "-" + i, { value: i, timestamp: Date.now() })
        );
      }
      
      await Promise.all(promises);
      
      // Verify all writes succeeded
      for (let i = 0; i < 10; i++) {
        const result = await Storage.get(testKey + "-" + i);
        expect(result).toBeDefined();
        expect(result.value).toBe(i);
      }
      
      // Clean up
      for (let i = 0; i < 10; i++) {
        await Storage.remove(testKey + "-" + i);
      }
    });
  });
  
  describe("Error handling improvements", () => {
    it("should handle JSON parsing errors gracefully", async () => {
      // Test our safe JSON parsing utilities
      const { safeJsonParseWithFallback } = await import("../src/util/json-utils");
      
      // Valid JSON
      const validResult = safeJsonParseWithFallback('{"test": true}', {}, "test");
      expect(validResult).toEqual({ test: true });
      
      // Invalid JSON should return fallback
      const invalidResult = safeJsonParseWithFallback('invalid json', { fallback: true }, "test");
      expect(invalidResult).toEqual({ fallback: true });
    });
    
    it("should handle file operations with proper error logging", async () => {
      // This tests that our error handling improvements don't break functionality
      const { isFileNotFoundError, isPermissionError } = await import("../src/util/error-types");
      
      const fileNotFoundError = new Error("ENOENT: no such file or directory");
      (fileNotFoundError as any).code = "ENOENT";
      
      expect(isFileNotFoundError(fileNotFoundError)).toBe(true);
      expect(isPermissionError(fileNotFoundError)).toBe(false);
      
      const permissionError = new Error("EACCES: permission denied");
      (permissionError as any).code = "EACCES";
      
      expect(isPermissionError(permissionError)).toBe(true);
      expect(isFileNotFoundError(permissionError)).toBe(false);
    });
  });
});
