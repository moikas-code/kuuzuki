import { Hono, type Context } from "hono";
import { AsyncQueue } from "../util/queue";
import { Permission } from "../permission";

interface Request {
  path: string;
  body: any;
}

const request = new AsyncQueue<Request>();
const response = new AsyncQueue<any>();

export async function callTui(ctx: Context) {
  const body = await ctx.req.json();
  request.push({
    path: ctx.req.path,
    body,
  });
  return response.next();
}

export const TuiRoute = new Hono()
  .get("/next", async (c) => {
    const req = await request.next();
    return c.json(req);
  })
  .post("/response", async (c) => {
    const body = await c.req.json();
    response.push(body);
    return c.json(true);
  })
  .get("/permissions/:sessionID", async (c) => {
    const sessionID = c.req.param("sessionID");
    const pending = Permission.getPendingForSession(sessionID);
    const current = Permission.getCurrentPermission(sessionID);

    return c.json({
      pending,
      current,
      count: pending.length,
    });
  })
  .get("/permissions/:sessionID/current", async (c) => {
    const sessionID = c.req.param("sessionID");
    const current = Permission.getCurrentPermission(sessionID);

    if (!current) {
      return c.json({ permission: null });
    }

    const displayInfo = Permission.getPermissionDisplayInfo(current);

    return c.json({
      permission: current,
      display: displayInfo,
    });
  });
