const baseUrl = (
  process.env.VORTA_PRODUCTION_URL ||
  "https://vorta-app.netlify.app"
).replace(/\/$/, "");
const expectedCommit = (
  process.env.EXPECTED_COMMIT ||
  process.env.GITHUB_SHA ||
  ""
).trim();
const timeoutMs = 12 * 60_000;
const pollIntervalMs = 15_000;

if (!expectedCommit) {
  throw new Error("EXPECTED_COMMIT or GITHUB_SHA is required.");
}

const metadataUrl = `${baseUrl}/vorta-build.json?commit=${encodeURIComponent(
  expectedCommit,
)}`;
const startedAt = Date.now();

while (Date.now() - startedAt < timeoutMs) {
  try {
    const response = await fetch(metadataUrl, {
      headers: {
        "Cache-Control": "no-cache",
      },
    });

    if (response.ok) {
      const metadata = await response.json();
      const deployedCommit = String(metadata.commit ?? "").trim();

      if (deployedCommit === expectedCommit) {
        console.log(
          `Verified production deployment ${deployedCommit} at ${baseUrl}.`,
        );
        process.exit(0);
      }

      console.log(
        `Production currently reports ${deployedCommit || "no commit"}; waiting for ${expectedCommit}.`,
      );
    } else {
      console.log(
        `Production metadata returned ${response.status}; waiting for deployment.`,
      );
    }
  } catch (error) {
    console.error("Production metadata check failed; retrying.", error);
  }

  await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
}

throw new Error(
  `Production did not report expected commit ${expectedCommit} within 12 minutes.`,
);
