import test from "node:test";
import assert from "node:assert/strict";
import { desiredStatus, targetState, taskFromBranch } from "./policy.mjs";

const prefixes = ["UD", "ST"];
const pr = (number, options = {}) => ({
  number,
  state: "open",
  draft: false,
  merged_at: null,
  head: { ref: "user/UD-3" },
  base: { ref: "dev" },
  ...options,
});
const decide = (event, pullRequests) =>
  desiredStatus({
    event,
    pullRequests,
    finalBranches: ["dev"],
    taskId: "UD-3",
    prefixes,
  });

test("extracts one whole identifier and rejects ambiguity and injection", () => {
  for (const name of ["user/UD-3", "feature/UD-3-description", "UD-3"])
    assert.equal(taskFromBranch(name, prefixes), "UD-3");
  for (const name of [
    "user/UD-3-ST-12",
    "user/UD-3-OTHER-2",
    "UD-30x",
    "none",
    "user/UD-0",
  ])
    assert.equal(taskFromBranch(name, prefixes), null);
  assert.equal(
    taskFromBranch("user/UD-3-$(touch /tmp/file)", prefixes),
    "UD-3",
  );
});
test("draft and ready states come from current PR snapshot", () => {
  assert.equal(
    decide({ kind: "pr", number: 1 }, [pr(1, { draft: true })]),
    "progress",
  );
  assert.equal(decide({ kind: "pr", number: 1 }, [pr(1)]), "review");
});
test("another ready PR takes precedence over closing or merging one", () => {
  assert.equal(
    decide({ kind: "pr", number: 1 }, [pr(1, { state: "closed" }), pr(2)]),
    "review",
  );
  assert.equal(
    decide({ kind: "pr", number: 1 }, [
      pr(1, { state: "closed", merged_at: "now" }),
      pr(2, { draft: true }),
    ]),
    "progress",
  );
});
test("only a merged PR into a configured final branch completes", () => {
  assert.equal(
    decide({ kind: "pr", number: 1 }, [
      pr(1, { state: "closed", merged_at: "now" }),
    ]),
    "completed",
  );
  assert.equal(
    decide({ kind: "pr", number: 1 }, [
      pr(1, {
        state: "closed",
        merged_at: "now",
        base: { ref: "feature/UD-3" },
      }),
    ]),
    "progress",
  );
  assert.equal(
    decide({ kind: "pr", number: 1 }, [pr(1, { state: "closed" })]),
    "progress",
  );
  assert.equal(decide({ kind: "pr", number: 2 }, [pr(1)]), "review");
});
test("create and protected terminal states", () => {
  assert.equal(decide({ kind: "create" }, []), "progress");
  assert.equal(
    targetState({ id: "x", group: "completed" }, "progress", { progress: "y" }),
    null,
  );
  assert.equal(
    targetState({ id: "x", group: "cancelled" }, "completed", {
      completed: "y",
    }),
    null,
  );
  assert.equal(
    targetState({ id: "x", group: "started" }, "progress", { progress: "x" }),
    null,
  );
});
