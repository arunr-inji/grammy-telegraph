# grammy-telegraph

A [grammY](https://grammy.dev) plugin for sending long messages via [Telegraph](https://telegra.ph).

Telegram bots have a hard 4096-character limit on messages. When you exceed it, the send fails. This plugin lets you create a Telegraph article from your text and send the link instead. Telegraph pages open natively inside Telegram via Instant View, so users don't leave the app.

## Installation

**Deno**

```ts
import { telegraph, type TelegraphContext } from "https://deno.land/x/grammy_telegraph/mod.ts";
```

**Node**

```
npm install grammy-telegraph
```

## Setup

You need a Telegraph access token. Get one by calling the [Telegraph API](https://telegra.ph/api#createAccount) directly, or use an existing one.

```ts
import { Bot } from "grammy";
import { telegraph, type TelegraphContext } from "grammy-telegraph";

type MyContext = TelegraphContext;
const bot = new Bot<MyContext>(process.env.BOT_TOKEN!);

bot.use(telegraph({ accessToken: process.env.TELEGRAPH_TOKEN! }));
```

## Usage

### Create a page and get the URL back

```ts
bot.command("report", async (ctx) => {
  const text = generateLongReport(); // your long string

  const { url } = await ctx.telegraph.createPage({
    title: "Report",
    text,
  });

  await ctx.reply(`Here is your report: ${url}`);
});
```

### Create a page and reply in one step

```ts
bot.command("report", async (ctx) => {
  await ctx.telegraph.replyWithTelegraph({
    title: "Report",
    text: generateLongReport(),
  });
});
```

`replyWithTelegraph` creates the page and calls `ctx.reply(url)` for you. If you want to control the message format (inline keyboard, parse mode, etc.), use `createPage` directly.

## Text formatting

Telegraph requires content as structured nodes, not plain text. This plugin converts your string automatically:

- Double newline (`\n\n`) starts a new paragraph
- Single newline stays inside the same paragraph

```
"First paragraph\n\nSecond paragraph"
// becomes two separate <p> blocks in Telegraph

"Line one\nLine two"
// becomes one <p> block with a line break inside
```

## Error handling

Telegraph API errors are thrown as `TelegraphError`:

```ts
import { TelegraphError } from "grammy-telegraph";

try {
  await ctx.telegraph.createPage({ title: "Report", text });
} catch (err) {
  if (err instanceof TelegraphError) {
    // err.message is the raw Telegraph error code, e.g. "Telegraph API error: ACCESS_TOKEN_INVALID"
    console.error(err.message);
  }
}
```

Common error codes from the Telegraph API:

| Code | Cause |
|------|-------|
| `ACCESS_TOKEN_INVALID` | Wrong or expired token |
| `TITLE_REQUIRED` | Empty title |
| `CONTENT_REQUIRED` | Empty text |
| `CONTENT_TOO_BIG` | Text exceeds Telegraph's 64KB limit |

## TypeScript

The plugin uses a [context flavor](https://grammy.dev/guide/context#context-flavors) to add `ctx.telegraph` to your context type. If you are combining multiple plugins:

```ts
import { type SessionFlavor } from "grammy";
import { type TelegraphFlavor } from "grammy-telegraph";

type MyContext = Context & SessionFlavor<SessionData> & TelegraphFlavor;
```

## License

MIT
