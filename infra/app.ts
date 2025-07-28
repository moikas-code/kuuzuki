export const domain = (() => {
  if ($app.stage === "production") return "kuuzuki.ai"
  if ($app.stage === "dev") return "dev.kuuzuki.ai"
  return `${$app.stage}.dev.kuuzuki.ai`
})()

const GITHUB_APP_ID = new sst.Secret("GITHUB_APP_ID")
const GITHUB_APP_PRIVATE_KEY = new sst.Secret("GITHUB_APP_PRIVATE_KEY")
const STRIPE_SECRET_KEY = new sst.Secret("STRIPE_SECRET_KEY")
const STRIPE_WEBHOOK_SECRET = new sst.Secret("STRIPE_WEBHOOK_SECRET")
const STRIPE_PRICE_ID = new sst.Secret("STRIPE_PRICE_ID")
const bucket = new sst.cloudflare.Bucket("Bucket")
const licenses = new sst.cloudflare.KV("Licenses")

export const api = new sst.cloudflare.Worker("Api", {
  domain: `api.${domain}`,
  handler: "packages/function/src/api.ts",
  environment: {
    WEB_DOMAIN: domain,
  },
  url: true,
  link: [bucket, licenses, GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID],
  transform: {
    worker: (args) => {
      args.logpush = true
      args.bindings = $resolve(args.bindings).apply((bindings) => [
        ...bindings,
        {
          name: "SYNC_SERVER",
          type: "durable_object_namespace",
          className: "SyncServer",
        },
      ])
      args.migrations = {
        // Note: when releasing the next tag, make sure all stages use tag v2
        oldTag: $app.stage === "production" ? "" : "v1",
        newTag: $app.stage === "production" ? "" : "v1",
        //newSqliteClasses: ["SyncServer"],
      }
    },
  },
})

new sst.cloudflare.x.Astro("Web", {
  domain,
  path: "packages/web",
  environment: {
    // For astro config
    SST_STAGE: $app.stage,
    VITE_API_URL: api.url,
  },
})
