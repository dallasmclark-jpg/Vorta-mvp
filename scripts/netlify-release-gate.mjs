const productionContext = process.env.CONTEXT === "production";
const commitSha = process.env.COMMIT_REF?.trim() ?? "";
const repository = "dallasmclark-jpg/Vorta-mvp";
const workflowFile = "maintenance-manager-quality.yml";
const pollIntervalMs = 60_000;
const timeoutMs = 50 * 60_000;
const requestTimeoutMs = 15_000;

if (!productionContext) {
  console.log("Netlify preview build: production quality gate not required.");
  process.exit(1);
}

if (!commitSha) {
  console.error("Netlify production build cancelled: COMMIT_REF is missing.");
  process.exit(0);
}

const apiUrl = new URL(
  `https://api.github.com/repos/${repository}/actions/workflows/${workflowFile}/runs`,
);
apiUrl.searchParams.set("head_sha", commitSha);
apiUrl.searchParams.set("per_page", "20");

const optionalToken = process.env.VORTA_RELEASE_GATE_GITHUB_TOKEN?.trim() ?? "";
const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "vorta-netlify-release-gate",
  "X-GitHub-Api-Version": "2022-11-28",
  ...(optionalToken ? { Authorization: `Bearer ${optionalToken}` } : {}),
};

const startedAt = Date.now();
let attempt = 0;

while (Date.now() - startedAt < timeoutMs) {
  attempt += 1;
  try {
    const response = await fetch(apiUrl, {
      headers,
      signal: AbortSignal.timeout(requestTimeoutMs),
    });

    if (!response.ok) {
      const remaining = response.headers.get("x-ratelimit-remaining");
      const resetEpoch = Number(response.headers.get("x-ratelimit-reset"));
      const resetAt = Number.isFinite(resetEpoch)
        ? new Date(resetEpoch * 1000).toISOString()
        : "unknown";
      console.error(
        `GitHub quality lookup returned ${response.status} on attempt ${attempt}; ` +
          `remaining=${remaining ?? "unknown"}, reset=${resetAt}. Retrying safely.`,
      );
    } else {
      const payload = await response.json();
      const runs = Array.isArray(payload.workflow_runs)
        ? payload.workflow_runs
        : [];
      const run = runs
        .filter(
          (candidate) =>
            candidate?.head_sha === commitSha &&
            candidate?.event === "push",
        )
        .sort(
          (left, right) =>
            new Date(right.created_at).getTime() -
            new Date(left.created_at).getTime(),
        )[0];

      if (run?.status === "completed") {
        if (run.conclusion === "success") {
          console.log(
            `GitHub quality gate passed for ${commitSha}. Proceeding with the production build.`,
          );
          process.exit(1);
        }

        console.error(
          `Netlify production build cancelled: GitHub quality gate concluded ${run.conclusion}.`,
        );
        process.exit(0);
      }

      console.log(
        run
          ? `Quality gate for ${commitSha} is ${run.status}; waiting one minute.`
          : `Quality gate for ${commitSha} has not started; waiting one minute.`,
      );
    }
  } catch (error) {
    console.error("GitHub quality lookup failed; retrying safely.", error);
  }

  await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
}

console.error(
  `Netlify production build cancelled: no successful quality result appeared for ${commitSha} within 50 minutes.`,
);
process.exit(0);
