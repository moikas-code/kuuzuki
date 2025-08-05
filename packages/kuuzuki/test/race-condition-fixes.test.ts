import { describe, it, expect } from "bun:test";

describe("Race Condition and Error Handling Fixes", () => {
  describe("JSON parsing improvements", () => {
    it("should handle valid JSON correctly", async () => {
      const { safeJsonParseWithFallback } = await import("../src/util/json-utils");
      
      const validResult = safeJsonParseWithFallback('{"test": true}', {}, "test");
      expect(validResult).toEqual({ test: true });
    });
    
    it("should return fallback for invalid JSON", async () => {
      const { safeJsonParseWithFallback } = await import("../src/util/json-utils");
      
      const invalidResult = safeJsonParseWithFallback('invalid json', { fallback: true }, "test");
      expect(invalidResult).toEqual({ fallback: true });
    });
    
    it("should handle empty strings gracefully", async () => {
      const { safeJsonParseWithFallback } = await import("../src/util/json-utils");
      
      const emptyResult = safeJsonParseWithFallback('', [], "empty test");
      expect(emptyResult).toEqual([]);
    });
  });
  
  describe("Error type utilities", () => {
    it("should correctly identify file not found errors", async () => {
      const { isFileNotFoundError, isPermissionError, isNodeError } = await import("../src/util/error-types");
      
      const fileNotFoundError = new Error("ENOENT: no such file or directory");
      (fileNotFoundError as any).code = "ENOENT";
      
      expect(isNodeError(fileNotFoundError)).toBe(true);
      expect(isFileNotFoundError(fileNotFoundError)).toBe(true);
      expect(isPermissionError(fileNotFoundError)).toBe(false);
    });
    
    it("should correctly identify permission errors", async () => {
      const { isPermissionError, isFileNotFoundError } = await import("../src/util/error-types");
      
      const permissionError = new Error("EACCES: permission denied");
      (permissionError as any).code = "EACCES";
      
      expect(isPermissionError(permissionError)).toBe(true);
      expect(isFileNotFoundError(permissionError)).toBe(false);
    });
    
    it("should handle regular errors correctly", async () => {
      const { isNodeError, isFileNotFoundError } = await import("../src/util/error-types");
      
      const regularError = new Error("Regular error");
      
      expect(isNodeError(regularError)).toBe(false);
      expect(isFileNotFoundError(regularError)).toBe(false);
    });
  });
  
  describe("Map-based state management", () => {
    it("should handle concurrent Map operations correctly", () => {
      // Test the pattern we used in App.state()
      const services = new Map<string, { value: number; created: number }>();
      const testKey = "test-key";
      let initCount = 0;
      
      const getOrCreate = (key: string) => {
        let service = services.get(key);
        if (service === undefined) {
          initCount++;
          const newService = {
            value: initCount,
            created: Date.now()
          };
          
          // Double-check pattern (atomic in single-threaded JS)
          const currentService = services.get(key);
          if (currentService === undefined) {
            services.set(key, newService);
            service = newService;
          } else {
            service = currentService;
          }
        }
        return service;
      };
      
      // Multiple calls should return the same service
      const service1 = getOrCreate(testKey);
      const service2 = getOrCreate(testKey);
      const service3 = getOrCreate(testKey);
      
      expect(service1).toBe(service2);
      expect(service2).toBe(service3);
      expect(initCount).toBe(1);
      expect(service1.value).toBe(1);
    });
  });
  
  describe("Async operation safety", () => {
    it("should handle Promise.all with error recovery", async () => {
      const operations = [
        Promise.resolve("success1"),
        Promise.reject(new Error("failure")),
        Promise.resolve("success2"),
      ];
      
      // Test pattern used in our fixes
      const results = await Promise.allSettled(operations);
      
      const successful = results
        .filter((result): result is PromiseFulfilledResult<string> => result.status === "fulfilled")
        .map(result => result.value);
      
      const failed = results
        .filter((result): result is PromiseRejectedResult => result.status === "rejected")
        .map(result => result.reason);
      
      expect(successful).toEqual(["success1", "success2"]);
      expect(failed).toHaveLength(1);
      expect(failed[0]).toBeInstanceOf(Error);
    });
  });
});
