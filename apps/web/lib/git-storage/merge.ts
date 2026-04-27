export interface ThreeWayMergeResult {
  content: string;
  conflicted: boolean;
}

export function threeWayMergeText(
  base: string,
  local: string,
  remote: string
): ThreeWayMergeResult {
  if (local === remote) {
    return { content: local, conflicted: false };
  }

  if (base === local) {
    return { content: remote, conflicted: false };
  }

  if (base === remote) {
    return { content: local, conflicted: false };
  }

  return {
    conflicted: true,
    content: [
      "<<<<<<< repomind-local",
      local.trimEnd(),
      "=======",
      remote.trimEnd(),
      ">>>>>>> repo-remote",
      "",
    ].join("\n"),
  };
}
