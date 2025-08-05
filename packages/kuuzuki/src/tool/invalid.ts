import { z } from "zod";
import { Tool } from "./tool";

/**
 * Invalid Tool - Error Handling Enhancement
 *
 * This tool captures invalid tool calls and provides structured error feedback
 * to both AI models and users. It's automatically invoked when tool calls fail
 * validation, transforming errors into meaningful information.
 *
 * This tool should never be called directly by AI models - it's only used
 * internally by the error repair mechanism.
 */
export const InvalidTool = Tool.define("invalid", {
  description:
    "Internal tool for capturing invalid tool calls - not for direct use by AI models",
  parameters: z.object({
    tool: z.string().describe("The original tool name that failed"),
    error: z.string().describe("The error message describing what went wrong"),
  }),
  async execute(params) {
    return {
      title: "Invalid Tool Call",
      output: `The arguments provided to the "${params.tool}" tool are invalid: ${params.error}

This error occurred because the tool call did not match the expected parameters or format. Please review the tool's documentation and try again with the correct arguments.`,
      metadata: {
        originalTool: params.tool,
        errorType: "invalid_arguments",
        timestamp: new Date().toISOString(),
        isErrorCapture: true,
      },
    };
  },
});
