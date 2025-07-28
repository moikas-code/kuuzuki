import { AgentrcSchema } from "../../config/agentrc"
import { zodToJsonSchema } from "zod-to-json-schema"
import type { CommandModule } from "yargs"

export const SchemaCommand = {
  command: "schema",
  describe: "Export JSON Schema for .agentrc configuration",
  builder: (yargs) =>
    yargs.option("output", {
      alias: "o",
      type: "string",
      description: "Output file path (prints to stdout if not specified)",
    }),
  handler: async (args) => {
    const schema = zodToJsonSchema(AgentrcSchema, {
      name: "AgentrcConfig",
      $refStrategy: "none",
    })

    // Add additional metadata
    const enhancedSchema = {
      ...schema,
      $schema: "http://json-schema.org/draft-07/schema#",
      title: ".agentrc Configuration Schema",
      description: "JSON Schema for kuuzuki .agentrc configuration files",
    }

    const output = JSON.stringify(enhancedSchema, null, 2)

    if (args["output"]) {
      const fs = await import("fs/promises")
      await fs.writeFile(args["output"] as string, output, "utf8")
      console.log(`Schema exported to ${args["output"]}`)
    } else {
      process.stdout.write(output)
    }
  },
} satisfies CommandModule