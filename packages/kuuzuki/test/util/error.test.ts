import { describe, test, expect } from "bun:test"
import { NamedError } from "../../src/util/error"
import { z } from "zod"

describe("NamedError", () => {
  describe("create", () => {
    test("should create a named error class", () => {
      const TestError = NamedError.create(
        "TestError",
        z.object({
          message: z.string(),
          code: z.number(),
        }),
      )

      const error = new TestError({
        message: "Test error message",
        code: 404,
      })

      expect(error.name).toBe("TestError")
      expect(error.data.message).toBe("Test error message")
      expect(error.data.code).toBe(404)
      expect(error instanceof Error).toBe(true)
      expect(error instanceof TestError).toBe(true)
    })

    test("should create error with cause", () => {
      const TestError = NamedError.create(
        "TestError",
        z.object({
          reason: z.string(),
        }),
      )

      const originalError = new Error("Original error")
      const error = new TestError(
        {
          reason: "Something went wrong",
        },
        { cause: originalError },
      )

      expect(error.data.reason).toBe("Something went wrong")
    })

    test("should work with complex schemas", () => {
      const TestError = NamedError.create(
        "ComplexTestError",
        z.object({
          user: z.object({
            id: z.string(),
            name: z.string(),
          }),
          permissions: z.array(z.string()),
          metadata: z.record(z.any()).optional(),
        }),
      )

      const error = new TestError({
        user: {
          id: "user-123",
          name: "John Doe",
        },
        permissions: ["read", "write"],
        metadata: {
          timestamp: Date.now(),
          source: "api",
        },
      })

      expect(error.name).toBe("ComplexTestError")
      expect(error.data.user.id).toBe("user-123")
      expect(error.data.user.name).toBe("John Doe")
      expect(error.data.permissions).toEqual(["read", "write"])
      expect(error.data.metadata?.["timestamp"]).toBeDefined()
      expect(error.data.metadata?.["source"]).toBe("api")
    })

    test("should be serializable", () => {
      const TestError = NamedError.create(
        "SerializableError",
        z.object({
          code: z.string(),
          details: z.object({
            field: z.string(),
            value: z.number(),
          }),
        }),
      )

      const error = new TestError({
        code: "VALIDATION_ERROR",
        details: {
          field: "age",
          value: -1,
        },
      })

      // Should be able to serialize to JSON
      const serialized = JSON.stringify({
        name: error.name,
        message: error.message,
        data: error.data,
      })

      const parsed = JSON.parse(serialized)
      expect(parsed.name).toBe("SerializableError")
      expect(parsed.data.code).toBe("VALIDATION_ERROR")
      expect(parsed.data.details.field).toBe("age")
      expect(parsed.data.details.value).toBe(-1)
    })

    test("should support inheritance", () => {
      const BaseError = NamedError.create(
        "BaseError",
        z.object({
          type: z.string(),
        }),
      )

      const SpecificError = NamedError.create(
        "SpecificError",
        z.object({
          type: z.string(),
          specificField: z.number(),
        }),
      )

      const baseError = new BaseError({ type: "base" })
      const specificError = new SpecificError({
        type: "specific",
        specificField: 123,
      })

      expect(baseError instanceof Error).toBe(true)
      expect(specificError instanceof Error).toBe(true)
      expect(baseError instanceof BaseError).toBe(true)
      expect(specificError instanceof SpecificError).toBe(true)
      expect(baseError instanceof SpecificError).toBe(false)
      expect(specificError instanceof BaseError).toBe(false)
    })

    test("should handle schema validation", () => {
      const TestError = NamedError.create(
        "ValidationError",
        z.object({
          timestamp: z.string(),
          count: z.number(),
        }),
      )

      const error = new TestError({
        timestamp: "2023-01-01T00:00:00Z",
        count: 42,
      })

      expect(error.data.timestamp).toBe("2023-01-01T00:00:00Z")
      expect(error.data.count).toBe(42)
    })
  })
})
