/* global Response */
import test from "node:test";
import assert from "node:assert/strict";
import { request, resolveStates, run } from "./sync.mjs";

const config = {
  enabled: true,
  workspace: "team",
  finalBranches: ["dev"],
  projects: {
    UD: { progress: "In Progress", review: "In Review", completed: "Done" },
  },
};
const states = [
  { id: "progress", name: "In Progress", group: "started" },
  { id: "review", name: "In Review", group: "started" },
  { id: "done", name: "Done", group: "completed" },
  { id: "todo", name: "Todo", group: "unstarted" },
];
const item = {
  id: "item",
  identifier: "UD-3",
  project_id: "project",
  state_id: "todo",
  updated_at: "time",
};
const pull = {
  number: 1,
  state: "open",
  draft: false,
  head: { ref: "user/UD-3", repo: { full_name: "owner/repo" } },
  base: { ref: "dev" },
};
const input = {
  config,
  event: { pull_request: pull },
  eventName: "pull_request_target",
  repository: "owner/repo",
  ghToken: "github-secret",
  planeToken: "plane-secret",
};

test("resolves project specific states and rejects ambiguous names", () => {
  assert.equal(resolveStates(states, config.projects.UD).review, "review");
  assert.throws(
    () =>
      resolveStates(
        [...states, { ...states[1], id: "duplicate" }],
        config.projects.UD,
      ),
    /ambiguous/,
  );
});
test("reads current data and patches only the state id", async () => {
  const calls = [];
  const api = async (url, options) => {
    calls.push([url, options]);
    if (url.includes("/pulls?")) return [pull];
    if (url.includes("/states/")) return { data: states, next: null };
    if (url.endsWith("/projects/project/"))
      return { id: "project", identifier: "UD" };
    if (options.method === "PATCH") return {};
    return item;
  };
  assert.equal(await run({ ...input, api }), "Updated UD-3 to review");
  assert.deepEqual(calls.at(-1)[1].body, { state_id: "review" });
  assert.equal(calls.filter(([, opts]) => opts.method === "PATCH").length, 1);
});
test("fork and disabled configuration do not access APIs", async () => {
  const api = () => {
    throw new Error("unexpected request");
  };
  assert.equal(
    await run({ ...input, config: { enabled: false }, api }),
    "Integration disabled",
  );
  assert.equal(
    await run({
      ...input,
      event: {
        pull_request: {
          ...pull,
          head: { ...pull.head, repo: { full_name: "fork/repo" } },
        },
      },
      api,
    }),
    "Fork PR skipped",
  );
});
test("manual changes between reads abort update", async () => {
  let reads = 0;
  const api = async (url, options) => {
    if (url.includes("/pulls?")) return [pull];
    if (url.includes("/states/")) return { data: states, next: null };
    if (url.endsWith("/projects/project/"))
      return { id: "project", identifier: "UD" };
    if (options.method === "PATCH") throw new Error("unexpected PATCH");
    return ++reads === 1 ? item : { ...item, updated_at: "later" };
  };
  assert.match(await run({ ...input, api }), /changed/);
});
test("API failures are propagated without printing tokens or response bodies", async () => {
  await assert.rejects(
    request("https://api.plane.so/test", {
      token: "secret",
      fetcher: async () => new Response("secret", { status: 403 }),
    }),
    (error) => error.message === "API request failed with HTTP 403",
  );
  await assert.rejects(
    request("https://evil.example/test", { token: "secret" }),
    /origin/,
  );
});
test("rate limits retry reads and respect Retry-After", async () => {
  let count = 0;
  const waits = [];
  const result = await request("https://api.plane.so/test", {
    token: "secret",
    fetcher: async () =>
      ++count === 1
        ? new Response("", { status: 429, headers: { "retry-after": "2" } })
        : Response.json({ ok: true }),
    sleep: async (ms) => waits.push(ms),
  });
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(waits, [2000]);
});
