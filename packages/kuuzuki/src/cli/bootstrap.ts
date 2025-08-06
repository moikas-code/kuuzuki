import { App } from "../app/app";
import { ConfigHooks } from "../config/hooks";
import { Format } from "../format";
import { LSP } from "../lsp";
import { Plugin } from "../plugin";
import { Share } from "../share/share";
import { Snapshot } from "../snapshot";
import { Session } from "../session";

export async function bootstrap<T>(
  input: App.Input,
  cb: (app: App.Info) => Promise<T>,
) {
  return App.provide(input, async (app) => {
    Share.init();
    Format.init();
    ConfigHooks.init();
    LSP.init();
    Snapshot.init();
    Plugin.init();
    Session.initializeSystem(); // Clean up stale session locks

    return cb(app);
  });
}
