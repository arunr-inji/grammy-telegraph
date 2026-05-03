import type { Context } from "./deps.deno.ts";

export class TelegraphError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TelegraphError";
  }
}

export interface TelegraphPageInput {
  title: string;
  text: string;
}

export interface PageResult {
  url: string;
  path: string;
}

export interface TelegraphOptions {
  accessToken: string;
}

export type TelegraphFlavor = {
  telegraph: {
    createPage(opts: TelegraphPageInput): Promise<PageResult>;
    replyWithTelegraph(opts: TelegraphPageInput): Promise<void>;
  };
};

export function textToNodes(
  text: string,
): Array<{ tag: string; children: string[] }> {
  return text
    .split("\n\n")
    .filter((p) => p.trim().length > 0)
    .map((p) => ({ tag: "p", children: [p] }));
}

async function createPage(
  accessToken: string,
  opts: TelegraphPageInput,
): Promise<PageResult> {
  const response = await fetch("https://api.telegra.ph/createPage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      access_token: accessToken,
      title: opts.title,
      content: textToNodes(opts.text),
    }),
  });

  const data = await response.json();

  if (!data.ok) {
    throw new TelegraphError(`Telegraph API error: ${data.error}`);
  }

  return {
    url: data.result.url,
    path: data.result.path,
  };
}

export type TelegraphContext = Context & TelegraphFlavor;

export function telegraph(opts: TelegraphOptions) {
  return async (ctx: TelegraphContext, next: () => Promise<void>) => {
    ctx.telegraph = {
      createPage: (pageOpts: TelegraphPageInput) =>
        createPage(opts.accessToken, pageOpts),
      replyWithTelegraph: async (pageOpts: TelegraphPageInput) => {
        const { url } = await createPage(opts.accessToken, pageOpts);
        await ctx.reply(url);
      },
    };
    await next();
  };
}
