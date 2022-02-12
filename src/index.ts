import got from "got";

import bot from "./bot.js";
import db from "./db.js";

const user = process.env.WHITELISTED_USER;

bot.on("message", (ctx, next) => {
  const isWhitelisted = user === ctx.from.id.toString();
  if (!isWhitelisted) return;
  return next();
});

bot.on("message", async (ctx, next) => {
  const text = (ctx.message as any)?.text;
  if (!text) return next();

  const [command, slug, floorThresholdString] = text.split(" ");

  if (command !== "track") return next();

  const floorThreshold = parseFloat(floorThresholdString);

  const currentCollection = db.data.collections.find((c) => c.slug === slug);

  if (currentCollection) {
    db.data.collections = db.data.collections.map((c) => {
      if (c.slug === slug) {
        return {
          ...c,
          floorThreshold,
        };
      }
      return c;
    });
  } else {
    db.data.collections.push({ slug, floorThreshold });
  }
  await db.write();

  ctx.reply("✅ Collection has been added.");
});

bot.on("message", async (ctx, next) => {
  const text = (ctx.message as any)?.text;
  if (!text) return next();

  const [command, slug] = text.split(" ");

  if (command !== "untrack") return next();

  db.data.collections = db.data.collections.filter((c) => c.slug !== slug);
  await db.write();
  ctx.reply("✅ Collection has been removed.");
});

let fetching: boolean;

setInterval(async () => {
  if (fetching) return;
  fetching = true;
  db.data.collections = await Promise.all(
    db.data.collections.map(async (c) => {
      const info = await got
        .get(`https://api.opensea.io/collection/${c.slug}`)
        .json<any>()
        .catch(() => null);
      const floor = info?.collection?.stats?.floor_price;
      const name = info?.collection?.name;

      if (!floor) return c;

      if (floor <= c.floorThreshold && c.floorOnLastAlert !== floor) {
        const indicator = floor > c.floorOnLastAlert ? "🟢" : "🔴";
        bot.telegram.sendMessage(
          Number(user),
          `${indicator} [${name || c.slug}](https://opensea.io/collection/${
            c.slug
          }) is now at *${floor} ETH*.`,
          { parse_mode: "Markdown", disable_web_page_preview: true },
        );
        return {
          ...c,
          floorOnLastAlert: floor,
        };
      }

      return c;
    }),
  );

  await db.write();
  fetching = false;
}, 1000 * 60 * (Number(process.env.FETCH_EVERY_MINUTES) || 1));
