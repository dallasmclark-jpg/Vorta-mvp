/**
 * VOR-074 isolated OpenAI Agents SDK shadow adapter.
 *
 * This module is deliberately outside the production Ask Vorta import graph.
 * It does not authenticate users, query Vorta data, alter deterministic routing,
 * persist sessions, export traces, or create operational writes. The caller must
 * supply the existing Vorta-owned tool executor and validators.
 */

export const VOR074_SHADOW_REVISION = "vor-074-sdk-shadow-v1";
export const VOR074_MAX_TURNS = 8;
export const VOR074_TOOL_TIMEOUT_MS = 15_000;

function assertFunction(value, name) {
  if (typeof value !== "function") {
    throw new TypeError(`${name} must be a function.`);
  }
}

function normaliseToolDefinition(definition) {
  if (!definition || typeof definition !== "object") {
    throw new TypeError("Every tool definition must be an object.");
  }
  const name = String(definition.name ?? "").trim();
  const description = String(definition.description ?? "").trim();
  const parameters = definition.parameters;
  if (!name || !description || !parameters || typeof parameters !== "object") {
    throw new TypeError("Every shadow tool needs name, description and JSON-schema parameters.");
  }
  return { name, description, parameters, strict: definition.strict !== false };
}

export async function loadAgentsSdk() {
  try {
    return await import("@openai/agents");
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      "The isolated VOR-074 experiment requires @openai/agents inside experiments/vor-074. " +
        `Production dependencies must not be changed for this proof. Original error: ${detail}`,
    );
  }
}

export async function createAskVortaSdkShadow(options) {
  const {
    model,
    instructions,
    answerSchema,
    toolDefinitions,
    executeTool,
    validateToolCall,
    validateOutput,
  } = options ?? {};

  if (!model) throw new TypeError("A model or SDK Model implementation is required.");
  if (typeof instructions !== "string" || !instructions.trim()) {
    throw new TypeError("Shadow instructions are required.");
  }
  if (!answerSchema || typeof answerSchema !== "object") {
    throw new TypeError("The existing Ask Vorta JSON answer schema is required.");
  }
  if (!Array.isArray(toolDefinitions)) {
    throw new TypeError("toolDefinitions must be an array.");
  }
  assertFunction(executeTool, "executeTool");
  assertFunction(validateToolCall, "validateToolCall");
  assertFunction(validateOutput, "validateOutput");

  const { Agent, Runner, tool } = await loadAgentsSdk();
  const executionLog = [];
  const shadowTools = toolDefinitions.map(normaliseToolDefinition).map((definition) =>
    tool({
      name: definition.name,
      description: definition.description,
      parameters: definition.parameters,
      strict: definition.strict,
      timeoutMs: VOR074_TOOL_TIMEOUT_MS,
      timeoutBehavior: "raise_exception",
      async execute(args, context, details) {
        const guard = await validateToolCall({
          name: definition.name,
          args,
          context,
          details,
        });
        if (!guard || guard.ok !== true) {
          throw new Error(
            typeof guard?.message === "string" && guard.message.trim()
              ? guard.message
              : `Vorta rejected ${definition.name} before execution.`,
          );
        }
        const startedAt = Date.now();
        const result = await executeTool(definition.name, args, { context, details });
        executionLog.push({
          name: definition.name,
          durationMs: Date.now() - startedAt,
          status:
            result && typeof result === "object" && typeof result.status === "string"
              ? result.status
              : "unknown",
        });
        return result;
      },
    }),
  );

  const agent = new Agent({
    name: "Ask Vorta VOR-074 shadow",
    instructions,
    model,
    tools: shadowTools,
    outputType: answerSchema,
  });

  const runner = new Runner({
    tracingDisabled: true,
    traceIncludeSensitiveData: false,
    workflowName: "VOR-074 isolated shadow proof",
  });

  return {
    agent,
    runner,
    executionLog,
    async run(input, context = undefined) {
      const startedAt = Date.now();
      const result = await runner.run(agent, input, {
        context,
        maxTurns: VOR074_MAX_TURNS,
      });
      const validated = await validateOutput(result.finalOutput, {
        result,
        executionLog: [...executionLog],
      });
      if (!validated || validated.ok !== true) {
        throw new Error(
          typeof validated?.message === "string" && validated.message.trim()
            ? validated.message
            : "Vorta rejected the SDK shadow output.",
        );
      }
      return {
        output: result.finalOutput,
        durationMs: Date.now() - startedAt,
        toolExecutions: [...executionLog],
        newItems: Array.isArray(result.newItems) ? result.newItems : [],
      };
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(
    "VOR-074 shadow adapter is installed as an isolated experiment. " +
      "Use the credentialled proof runner to supply Vorta's existing model, schemas, tool executor and validators.",
  );
}
