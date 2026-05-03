import { assertEquals, assertInstanceOf, assertRejects } from "@std/assert";
import {
  telegraph,
  type TelegraphContext,
  TelegraphError,
  textToNodes,
} from "../src/mod.ts";

// --- TelegraphError ---

Deno.test("TelegraphError is an instance of Error", () => {
  const err = new TelegraphError("something went wrong");
  assertInstanceOf(err, Error);
});

Deno.test("TelegraphError has correct message", () => {
  const err = new TelegraphError("something went wrong");
  assertEquals(err.message, "something went wrong");
});

Deno.test("TelegraphError has correct name", () => {
  const err = new TelegraphError("something went wrong");
  assertEquals(err.name, "TelegraphError");
});

// --- textToNodes ---

Deno.test("textToNodes wraps single paragraph in p tag", () => {
  const nodes = textToNodes("Hello world");
  assertEquals(nodes, [{ tag: "p", children: ["Hello world"] }]);
});

Deno.test("textToNodes splits on double newline into separate p tags", () => {
  const nodes = textToNodes("Para one\n\nPara two");
  assertEquals(nodes, [
    { tag: "p", children: ["Para one"] },
    { tag: "p", children: ["Para two"] },
  ]);
});

Deno.test("textToNodes filters empty paragraphs from multiple newlines", () => {
  const nodes = textToNodes("Para one\n\n\n\nPara two");
  assertEquals(nodes, [
    { tag: "p", children: ["Para one"] },
    { tag: "p", children: ["Para two"] },
  ]);
});

Deno.test("textToNodes keeps single newline within the same p tag", () => {
  const nodes = textToNodes("Line one\nLine two");
  assertEquals(nodes, [{ tag: "p", children: ["Line one\nLine two"] }]);
});

// --- ctx.telegraph.createPage ---

Deno.test("createPage returns url and path on success", async () => {
  const mockResponse = {
    ok: true,
    result: {
      url: "https://telegra.ph/Test-Report-05-03",
      path: "Test-Report-05-03",
    },
  };

  const originalFetch = globalThis.fetch;
  let capturedBody: unknown;
  let capturedUrl: string;

  globalThis.fetch = ((url: string, opts: RequestInit) => {
    capturedUrl = url;
    capturedBody = JSON.parse(opts.body as string);
    return Promise.resolve(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );
  }) as typeof fetch;

  const ctx = {} as TelegraphContext;
  const middleware = telegraph({ accessToken: "test-token" });

  try {
    await middleware(ctx, () => Promise.resolve());

    const result = await ctx.telegraph.createPage({
      title: "Test Report",
      text: "First paragraph\n\nSecond paragraph",
    });

    assertEquals(result.url, "https://telegra.ph/Test-Report-05-03");
    assertEquals(result.path, "Test-Report-05-03");
    assertEquals(capturedUrl!, "https://api.telegra.ph/createPage");
    assertEquals(
      (capturedBody as Record<string, unknown>).access_token,
      "test-token",
    );
    assertEquals(
      (capturedBody as Record<string, unknown>).title,
      "Test Report",
    );
    assertEquals((capturedBody as Record<string, unknown>).content, [
      { tag: "p", children: ["First paragraph"] },
      { tag: "p", children: ["Second paragraph"] },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("createPage throws TelegraphError when API returns ok: false", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = ((_url: string, _opts: RequestInit) => {
    return Promise.resolve(
      new Response(
        JSON.stringify({ ok: false, error: "ACCESS_TOKEN_INVALID" }),
        { status: 200 },
      ),
    );
  }) as typeof fetch;

  const ctx = {} as TelegraphContext;
  const middleware = telegraph({ accessToken: "bad-token" });

  try {
    await middleware(ctx, () => Promise.resolve());

    await assertRejects(
      () => ctx.telegraph.createPage({ title: "Test", text: "content" }),
      TelegraphError,
      "Telegraph API error: ACCESS_TOKEN_INVALID",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// --- telegraph() middleware ---

Deno.test("telegraph() installs createPage on ctx", async () => {
  const mockResponse = {
    ok: true,
    result: {
      url: "https://telegra.ph/Test-05-03",
      path: "Test-05-03",
    },
  };

  const originalFetch = globalThis.fetch;
  const ctx = {} as TelegraphContext;
  const middleware = telegraph({ accessToken: "test-token" });
  let nextCalled = false;

  globalThis.fetch = ((_url: string, _opts: RequestInit) => {
    return Promise.resolve(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );
  }) as typeof fetch;

  try {
    await middleware(ctx, () => {
      nextCalled = true;
      return Promise.resolve();
    });

    assertEquals(nextCalled, true);

    const result = await ctx.telegraph.createPage({
      title: "Test",
      text: "Hello world",
    });
    assertEquals(result.url, "https://telegra.ph/Test-05-03");
    assertEquals(result.path, "Test-05-03");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// --- replyWithTelegraph ---

Deno.test("replyWithTelegraph calls ctx.reply with the Telegraph URL", async () => {
  const mockResponse = {
    ok: true,
    result: {
      url: "https://telegra.ph/My-Report-05-03",
      path: "My-Report-05-03",
    },
  };

  const originalFetch = globalThis.fetch;
  let repliedWith: string | undefined;

  const ctx = {
    reply: (text: string) => {
      repliedWith = text;
      return Promise.resolve();
    },
  } as unknown as TelegraphContext;

  const middleware = telegraph({ accessToken: "test-token" });

  globalThis.fetch = ((_url: string, _opts: RequestInit) => {
    return Promise.resolve(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );
  }) as typeof fetch;

  try {
    await middleware(ctx, () => Promise.resolve());
    await ctx.telegraph.replyWithTelegraph({
      title: "My Report",
      text: "Long content here",
    });
    assertEquals(repliedWith, "https://telegra.ph/My-Report-05-03");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
