/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "kuuzuki",
      home: "cloudflare",
      providers: {
        cloudflare: "5.42.0",
      },
    }
  },
  async run() {
    await import("./infra/app.ts")
  },
})