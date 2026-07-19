const productionContext = process.env.CONTEXT === "production";
const commitSha = process.env.COMMIT_REF?.trim() ?? "";
const repository = "dallasmclark-jpg/Vorta-mvp";
const workflowFile = "maintenance-manager-quality.yml";
const pollIntervalMs = 10_000;
const timeoutMs = 20 * 60_000;

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

const startedAt = Date.now();

while (Date.now() - startedAt < timeoutMs) {
  try {
    const response = await fetch(apiUrl, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "vorta-netlify-release-gate",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      console.error(
        `GitHub quality lookup returned ${response.status}; retrying.`,
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
          ? `Quality gate for ${commitSha} is ${run.status}; waiting.`
          : `Quality gate for ${commitSha} has not started; waiting.`,
      );
    }
  } catch (error) {
    console.error("GitHub quality lookup failed; retrying.", error);
  }

  await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
}

console.error(
  `Netlify production build cancelled: no successful quality result appeared for ${commitSha} within 20 minutes.`,
);
process.exit(0);
