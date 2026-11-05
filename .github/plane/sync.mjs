/* global fetch, setTimeout, URL, AbortSignal, process, console */
import { readFile } from "node:fs/promises";
import { desiredStatus, targetState, taskFromBranch } from "./policy.mjs";

const planeOrigin = "https://api.plane.so";
const githubOrigin = "https://api.github.com";

export async function request(
  url,
  {
    token,
    method = "GET",
    body,
    fetcher = fetch,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  },
) {
  const parsed = new URL(url);
  if (
    ![planeOrigin, githubOrigin].includes(parsed.origin) ||
    parsed.protocol !== "https:"
  )
    throw new Error("Unexpected API origin");
  for (let attempt = 0; attempt < 4; attempt++) {
    let response;
    try {
      response = await fetcher(url, {
        method,
        redirect: "error",
        signal: AbortSignal.timeout(20000),
        headers: {
          Accept: "application/json",
          ...(parsed.origin === planeOrigin
            ? { "X-Api-Key": token }
            : {
                Authorization: `Bearer ${token}`,
                "X-GitHub-Api-Version": "2022-11-28",
              }),
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      // Retrying an ambiguous write may overwrite a subsequent manual change.
      if (method !== "GET" || attempt === 3)
        throw new Error("API network failure");
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    if (response.ok) {
      try {
        return await response.json();
      } catch {
        throw new Error("Invalid API response");
      }
    }
    if (
      method === "GET" &&
      (response.status === 429 || response.status >= 500) &&
      attempt < 3
    ) {
      const retry = response.headers.get("retry-after");
      const seconds =
        retry && /^\d+$/.test(retry) ? Number(retry) : 2 ** attempt;
      if (seconds > 60)
        throw new Error(
          `API rate limit requires retry after ${seconds} seconds`,
        );
      await sleep(seconds * 1000);
      continue;
    }
    throw new Error(`API request failed with HTTP ${response.status}`);
  }
}

export async function planeStates(base, token, api = request) {
  const all = [];
  let offset = 0;
  do {
    const result = await api(`${base}/states/?per_page=200&offset=${offset}`, {
      token,
    });
    if (
      !Array.isArray(result.data) ||
      (result.next !== null &&
        (!Number.isInteger(result.next) || result.next <= offset))
    )
      throw new Error("Unexpected Plane pagination");
    all.push(...result.data);
    offset = result.next;
  } while (offset !== null);
  return all;
}

export function resolveStates(rows, names) {
  const result = {};
  for (const [key, group] of [
    ["progress", "started"],
    ["review", "started"],
    ["completed", "completed"],
  ]) {
    const matching = rows.filter(
      (s) => s.name === names[key] && s.group === group,
    );
    if (matching.length !== 1 || !matching[0].id)
      throw new Error(`Plane state ${key} is missing or ambiguous`);
    result[key] = matching[0].id;
  }
  if (new Set(Object.values(result)).size !== 3)
    throw new Error("Plane states must be distinct");
  return result;
}

export async function run({
  config,
  event,
  eventName,
  repository,
  ghToken,
  planeToken,
  api = request,
}) {
  if (!config.enabled) return "Integration disabled";
  if (!/^[a-zA-Z0-9_-]+$/.test(config.workspace || ""))
    throw new Error("Configure Plane workspace slug");
  if (!Array.isArray(config.finalBranches) || config.finalBranches.length === 0)
    throw new Error("Configure final branches");
  if (!ghToken || !planeToken) throw new Error("Missing API credentials");
  const prefixes = Object.keys(config.projects);
  let branch;
  let eventInfo;
  if (eventName === "create" && event.ref_type === "branch") {
    branch = event.ref;
    eventInfo = { kind: "create" };
  } else if (eventName === "pull_request_target") {
    const pull = event.pull_request;
    if (!pull || pull.head.repo?.full_name !== repository)
      return "Fork PR skipped";
    branch = pull.head.ref;
    eventInfo = { kind: "pr", number: pull.number };
  } else return "Unsupported event";
  const id = taskFromBranch(branch, prefixes);
  if (!id) return "No unambiguous task identifier";
  const repoPath = repository.split("/").map(encodeURIComponent).join("/");
  const ghBase = `${githubOrigin}/repos/${repoPath}`;
  const pulls = [];
  for (let page = 1; ; page++) {
    const rows = await api(
      `${ghBase}/pulls?state=open&per_page=100&page=${page}`,
      { token: ghToken },
    );
    if (!Array.isArray(rows)) throw new Error("Unexpected GitHub response");
    pulls.push(...rows.filter((pr) => pr.head.repo?.full_name === repository));
    if (rows.length < 100) break;
    if (page >= 100) throw new Error("Too many GitHub pull requests");
  }
  if (
    eventInfo.kind === "pr" &&
    !pulls.some((pr) => pr.number === eventInfo.number)
  ) {
    pulls.push(
      await api(`${ghBase}/pulls/${eventInfo.number}`, { token: ghToken }),
    );
  }
  const desired = desiredStatus({
    event: eventInfo,
    pullRequests: pulls,
    finalBranches: config.finalBranches,
    taskId: id,
    prefixes,
  });
  if (!desired) return "No status change";
  const planeBase = `${planeOrigin}/api/v2/workspaces/${encodeURIComponent(config.workspace)}`;
  const itemUrl = `${planeBase}/work-items/${id}/`;
  const item = await api(itemUrl, { token: planeToken });
  if (
    !item.id ||
    !item.project_id ||
    item.identifier !== id ||
    item.archived_at
  )
    throw new Error("Invalid or archived Plane work item");
  const prefix = id.slice(0, id.lastIndexOf("-"));
  const project = await api(
    `${planeBase}/projects/${encodeURIComponent(item.project_id)}/`,
    { token: planeToken },
  );
  if (project.id !== item.project_id || project.identifier !== prefix)
    throw new Error("Plane project does not match identifier");
  const projectBase = `${planeBase}/projects/${encodeURIComponent(item.project_id)}`;
  const states = await planeStates(projectBase, planeToken, api);
  const stateIds = resolveStates(
    states,
    config.projects[id.slice(0, id.lastIndexOf("-"))],
  );
  const current = states.find((state) => state.id === item.state_id);
  if (!current) throw new Error("Current Plane state not found");
  const target = targetState(current, desired, stateIds);
  if (!target) return "Already in target or protected terminal state";
  // Re-read to reduce the chance of overwriting a manual edit. The API does not
  // document an atomic conditional PATCH, so this cannot eliminate the race.
  const latest = await api(itemUrl, { token: planeToken });
  if (
    latest.state_id !== item.state_id ||
    latest.updated_at !== item.updated_at
  )
    return "Plane work item changed; skipped";
  await api(`${projectBase}/work-items/${encodeURIComponent(item.id)}/`, {
    token: planeToken,
    method: "PATCH",
    body: { state_id: target },
  });
  return `Updated ${id} to ${desired}`;
}

if (process.argv[1]?.endsWith("/sync.mjs")) {
  try {
    const config = JSON.parse(
      await readFile(new URL("./config.json", import.meta.url), "utf8"),
    );
    const event = JSON.parse(
      await readFile(process.env.GITHUB_EVENT_PATH, "utf8"),
    );
    console.log(
      await run({
        config,
        event,
        eventName: process.env.GITHUB_EVENT_NAME,
        repository: process.env.GITHUB_REPOSITORY,
        ghToken: process.env.GH_TOKEN,
        planeToken: process.env.PLANE_API_KEY,
      }),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
