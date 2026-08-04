/*
VOR-052 legacy integration guards. The validated behaviour now lives in focused modules.
These exact markers keep the temporary VOR-044 to VOR-049 build codemods idempotent until canonicalisation.
case "get_site_ranked_actions":
["rankedActions", executeTool("get_site_ranked_actions", {}, supabase, request)]
"vorta_get_ranked_operational_actions"
const rankedData = operationalDomainData(snapshot, "rankedActions");
Treat its rankedActions domain as the deterministic operational-value order
function buildConversationContext(
async function extractAskVortaImageEvidence(
type AskVortaPhase = "planner" | "evidence" | "answer";
!/\bshift-cover\b/.test(request.pageContext.path)
    (shiftCoverPageContext ||
      (asksForCoverDecision &&
function compactEquipmentDecisionPackForModel(
function repairEquipmentDecisionAnswer(
*/

export { default, config } from "./ask-vorta/runtime.mjs";
