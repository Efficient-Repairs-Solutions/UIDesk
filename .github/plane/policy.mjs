// Treat branch names as data. A task identifier must be a whole path or
// hyphen-delimited component; multiple distinct identifiers are ambiguous.
export function taskFromBranch(branch, prefixes) {
  if (typeof branch !== "string") return null;
  const matches = [
    ...branch
      .toUpperCase()
      .matchAll(/(?<![A-Z0-9])([A-Z][A-Z0-9]*-[1-9][0-9]*)(?![A-Z0-9])/g),
  ].map((match) => match[1]);
  const unique = [...new Set(matches)];
  return unique.length === 1 &&
    prefixes.includes(unique[0].slice(0, unique[0].lastIndexOf("-")))
    ? unique[0]
    : null;
}

// This function receives a fresh, complete snapshot of matching PRs, not just
// the webhook payload. It never assumes a merge into a work branch is final.
export function desiredStatus({
  event,
  pullRequests,
  finalBranches,
  taskId,
  prefixes,
}) {
  const associated = pullRequests.filter(
    (pr) => taskFromBranch(pr.head.ref, prefixes) === taskId,
  );
  const open = associated.filter((pr) => pr.state === "open");
  if (open.some((pr) => !pr.draft)) return "review";
  if (open.length) return "progress";
  if (event.kind === "create") return "progress";
  const current = associated.find((pr) => pr.number === event.number);
  if (!current || current.state !== "closed") return null;
  if (!current.merged_at) return "progress";
  if (finalBranches.includes(current.base.ref)) return "completed";
  return "progress";
}

export function targetState(current, desired, states) {
  if (
    !desired ||
    !current ||
    ["completed", "cancelled"].includes(current.group)
  )
    return null;
  const target = states[desired];
  if (!target || target === current.id) return null;
  return target;
}
