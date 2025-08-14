import type { StandardSchemaV1 } from "@standard-schema/spec";

/**
 * Tool Interface Definitions - Internal Type System
 *
 * This module defines the core interfaces and types for the tool system.
 * It provides the foundational types that all tools implement.
 *
 * This is an internal type definition module and does not need a .txt description file
 * because it's not a user-facing tool registered in the ToolRegistry.
 */
export namespace Tool {
  interface Metadata {
    [key: string]: any;
  }
  export type Context<M extends Metadata = Metadata> = {
    sessionID: string;
    messageID: string;
    toolCallID: string;
    abort: AbortSignal;
    extra?: { [key: string]: any };
    metadata(input: { title?: string; metadata?: M }): void;
  };
  export interface Info<
    Parameters extends StandardSchemaV1 = StandardSchemaV1,
    M extends Metadata = Metadata,
  > {
    id: string;
    init: () => Promise<{
      description: string;
      parameters: Parameters;
      execute(
        args: StandardSchemaV1.InferOutput<Parameters>,
        ctx: Context,
      ): Promise<{
        title: string;
        metadata: M;
        output: string;
      }>;
    }>;
  }

  export function define<
    Parameters extends StandardSchemaV1,
    Result extends Metadata,
  >(
    id: string,
    init:
      | Info<Parameters, Result>["init"]
      | Awaited<ReturnType<Info<Parameters, Result>["init"]>>,
  ): Info<Parameters, Result> {
    return {
      id,
      init: async () => {
        if (init instanceof Function) return init();
        return init;
      },
    };
  }
}
