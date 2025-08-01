import { z } from "zod"
import { Tool } from "./tool"
import DESCRIPTION_WRITE from "./todowrite.txt"
import DESCRIPTION_READ from "./todoread.txt"
import { App } from "../app/app"

const TodoInfo = z.object({
  content: z.string().min(1).describe("Brief description of the task"),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]).describe("Current status of the task"),
  priority: z.enum(["high", "medium", "low", "critical"]).describe("Priority level of the task"),
  id: z.string().describe("Unique identifier for the todo item"),
})
type TodoInfo = z.infer<typeof TodoInfo>

const state = App.state("todo-tool", () => {
  const todos: {
    [sessionId: string]: TodoInfo[]
  } = {}
  return todos
})

export const TodoWriteTool = Tool.define("todowrite", {
  description: DESCRIPTION_WRITE,
  parameters: z.object({
    todos: z.array(TodoInfo).describe("The updated todo list"),
  }),
  async execute(params, opts) {
    const todos = state()
    todos[opts.sessionID] = params.todos
    return {
      title: `${params.todos.filter((x) => x.status !== "completed").length} todos`,
      output: JSON.stringify(params.todos, null, 2),
      metadata: {
        todos: params.todos,
      },
    }
  },
})

export const TodoReadTool = Tool.define("todoread", {
  description: DESCRIPTION_READ,
  parameters: z.object({}),
  async execute(_params, opts) {
    const todos = state()[opts.sessionID] ?? []
    return {
      title: `${todos.filter((x) => x.status !== "completed").length} todos`,
      metadata: {
        todos,
      },
      output: JSON.stringify(todos, null, 2),
    }
  },
})
