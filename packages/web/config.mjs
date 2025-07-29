const stage = process.env.SST_STAGE || "dev"

export default {
  url: stage === "production"
    ? "https://kuuzuki.com"
    : `https://${stage}.kuuzuki.com`,
  socialCard: "https://social-cards.sst.dev",
  github: "https://github.com/moikas-code/kuuzuki",
  discord: "https://kuuzuki.com/discord",
  headerLinks: [
    { name: "Home", url: "/" },
    { name: "Docs", url: "/docs/" },
  ],
}
