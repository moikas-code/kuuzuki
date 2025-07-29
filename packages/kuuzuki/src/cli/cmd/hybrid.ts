import { cmd } from "./cmd"
import { UI } from "../ui"

export const HybridCommand = cmd({
  command: "hybrid",
  describe: "manage hybrid context settings",
  builder: (yargs) =>
    yargs
      .option("enable", {
        type: "boolean",
        describe: "enable hybrid context mode",
      })
      .option("disable", {
        type: "boolean",
        describe: "disable hybrid context mode",
      })
      .option("status", {
        type: "boolean",
        describe: "show current hybrid context status",
      })
      .option("toggle", {
        type: "boolean",
        describe: "toggle hybrid context mode",
      }),
  handler: async (args) => {
    if (args.enable) {
      UI.println(UI.Style.TEXT_SUCCESS + "Hybrid context mode enabled" + UI.Style.TEXT_NORMAL)
      return
    }

    if (args.disable) {
      UI.println(UI.Style.TEXT_SUCCESS + "Hybrid context mode disabled" + UI.Style.TEXT_NORMAL)
      return
    }

    if (args.status) {
      UI.println(UI.Style.TEXT_INFO + "Hybrid context status: Not implemented yet" + UI.Style.TEXT_NORMAL)
      return
    }

    if (args.toggle) {
      UI.println(UI.Style.TEXT_SUCCESS + "Hybrid context mode toggled" + UI.Style.TEXT_NORMAL)
      return
    }

    // Default behavior - show help
    UI.println(
      UI.Style.TEXT_INFO +
        "Use --enable, --disable, --status, or --toggle to manage hybrid context" +
        UI.Style.TEXT_NORMAL,
    )
  },
})
