import { App } from "../app/app";
import { z } from "zod";
import { Bus } from "../bus";
import { Log } from "../util/log";
import { Identifier } from "../id/id";

export namespace Permission {
  const log = Log.create({ service: "permission" });

  export const Info = z
    .object({
      id: z.string(),
      type: z.string(),
      pattern: z.string().optional(),
      sessionID: z.string(),
      messageID: z.string(),
      callID: z.string().optional(),
      title: z.string(),
      metadata: z.record(z.any()),
      time: z.object({
        created: z.number(),
      }),
    })
    .openapi({
      ref: "permission.info",
    });
  export type Info = z.infer<typeof Info>;

  export const Event = {
    Updated: Bus.event("permission.updated", Info),
  };

  const state = App.state(
    "permission",
    () => {
      const pending: {
        [sessionID: string]: {
          [permissionID: string]: {
            info: Info;
            resolve: () => void;
            reject: (e: any) => void;
          };
        };
      } = {};

      const approved: {
        [sessionID: string]: {
          [patternOrType: string]: boolean;
        };
      } = {};

      return {
        pending,
        approved,
      };
    },
    async (state) => {
      for (const pending of Object.values(state.pending)) {
        for (const item of Object.values(pending)) {
          item.reject(new RejectedError(item.info.sessionID, item.info.id));
        }
      }
    },
  );

  export async function ask(input: {
    type: Info["type"];
    title: Info["title"];
    pattern?: Info["pattern"];
    callID?: Info["callID"];
    sessionID: Info["sessionID"];
    messageID: Info["messageID"];
    metadata: Info["metadata"];
  }) {
    const { pending, approved } = state();

    log.info("asking", {
      sessionID: input.sessionID,
      messageID: input.messageID,
      toolCallID: input.callID,
      type: input.type,
      pattern: input.pattern,
    });

    // Check if this pattern/type was previously approved
    const approvalKey = input.pattern ?? input.type;
    if (approved[input.sessionID]?.[approvalKey]) {
      log.info("previously approved", {
        sessionID: input.sessionID,
        type: input.type,
        pattern: input.pattern,
      });
      return;
    }

    const info: Info = {
      id: Identifier.ascending("permission"),
      type: input.type,
      pattern: input.pattern,
      sessionID: input.sessionID,
      messageID: input.messageID,
      callID: input.callID,
      title: input.title,
      metadata: input.metadata,
      time: {
        created: Date.now(),
      },
    };
    pending[input.sessionID] = pending[input.sessionID] || {};
    return new Promise<void>((resolve, reject) => {
      pending[input.sessionID][info.id] = {
        info,
        resolve,
        reject,
      };
      Bus.publish(Event.Updated, info);
    });
  }

  export const Response = z.enum(["once", "always", "reject"]);
  export type Response = z.infer<typeof Response>;

  export function respond(input: {
    sessionID: Info["sessionID"];
    permissionID: Info["id"];
    response: Response;
  }) {
    log.info("response", input);
    const { pending, approved } = state();
    const match = pending[input.sessionID]?.[input.permissionID];
    if (!match) return;
    delete pending[input.sessionID][input.permissionID];
    if (input.response === "reject") {
      match.reject(
        new RejectedError(
          input.sessionID,
          input.permissionID,
          match.info.callID,
        ),
      );
      return;
    }
    match.resolve();
    if (input.response === "always") {
      approved[input.sessionID] = approved[input.sessionID] || {};
      const approvalKey = match.info.pattern ?? match.info.type;
      approved[input.sessionID][approvalKey] = true;

      // Auto-approve any other pending requests with the same pattern/type
      for (const item of Object.values(pending[input.sessionID])) {
        const itemApprovalKey = item.info.pattern ?? item.info.type;
        if (itemApprovalKey === approvalKey) {
          respond({
            sessionID: item.info.sessionID,
            permissionID: item.info.id,
            response: input.response,
          });
        }
      }
    }
  }

  export class RejectedError extends Error {
    constructor(
      public readonly sessionID: string,
      public readonly permissionID: string,
      public readonly toolCallID?: string,
    ) {
      super(`The user rejected permission to use this functionality`);
    }
  }
}
