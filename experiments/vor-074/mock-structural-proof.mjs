import { createAskVortaSdkShadow } from "./sdk-shadow.mjs";

const answerSchema = {
  type: "object",
  properties: {
    directAnswer: { type: "string" },
  },
  required: ["directAnswer"],
  additionalProperties: false,
};

const toolDefinitions = [
  {
    type: "function",
    name: "get_test_evidence",
    description: "Return bounded fixture evidence for the VOR-074 structural proof.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
];

function assistantJson(value) {
  return {
    type: "message",
    role: "assistant",
    status: "completed",
    content: [{ type: "output_text", text: JSON.stringify(value) }],
  };
}

function functionCall(argumentsJson = '{"query":"VF-02"}') {
  return {
    type: "function_call",
    name: "get_test_evidence",
    callId: crypto.randomUUID(),
    arguments: argumentsJson,
    status: "completed",
  };
}

class ScriptedModel {
  constructor(outputs) {
    this.name = "vor-074-scripted-model";
    this.outputs = [...outputs];
  }

  async getResponse() {
    const output = this.outputs.shift();
    if (!output) throw new Error("Scripted model ran out of outputs.");
    return { usage: {}, output: Array.isArray(output) ? output : [output] };
  }

  async *getStreamedResponse() {
    throw new Error("Streaming is not used by the VOR-074 structural proof.");
  }
}

async function expectReject(label, operation, assertion) {
  let rejected = false;
  try {
    await operation();
  } catch (error) {
    rejected = assertion(error);
  }
  if (!rejected) throw new Error(`${label} did not fail closed as expected.`);
  console.log(`PASS ${label}`);
}

async function validLoopProof() {
  let toolExecutions = 0;
  const shadow = await createAskVortaSdkShadow({
    model: new ScriptedModel([
      functionCall(),
      assistantJson({ directAnswer: "Use the verified fixture evidence." }),
    ]),
    instructions: "Use the supplied test tool once, then return the structured answer.",
    answerSchema,
    toolDefinitions,
    validateToolCall: async ({ name, args }) => ({
      ok: name === "get_test_evidence" && args?.query === "VF-02",
      message: "Tool call did not satisfy the Vorta pre-execution boundary.",
    }),
    executeTool: async (name, args) => {
      toolExecutions += 1;
      return {
        source: "VOR-074 fixture",
        status: "ok",
        data: { name, query: args.query, evidence: "authorised fixture only" },
      };
    },
    validateOutput: async (output) => ({
      ok: output?.directAnswer === "Use the verified fixture evidence.",
      message: "Final output did not match the Vorta validator expectation.",
    }),
  });

  const result = await shadow.run("Run the structural proof.");
  if (toolExecutions !== 1) throw new Error(`Expected one tool execution, got ${toolExecutions}.`);
  if (result.toolExecutions.length !== 1) throw new Error("Shadow execution log did not retain the tool call.");
  if (result.output?.directAnswer !== "Use the verified fixture evidence.") {
    throw new Error("Structured output was not returned by the SDK runner.");
  }
  console.log("PASS valid SDK tool loop + structured output");
}

async function malformedArgumentsProof() {
  let toolExecutions = 0;
  const shadow = await createAskVortaSdkShadow({
    model: new ScriptedModel([functionCall("{}")]),
    instructions: "Attempt the fixture tool call.",
    answerSchema,
    toolDefinitions,
    validateToolCall: async () => ({ ok: true }),
    executeTool: async () => {
      toolExecutions += 1;
      return { status: "ok" };
    },
    validateOutput: async () => ({ ok: true }),
  });

  await expectReject(
    "strict malformed tool arguments",
    () => shadow.run("Call the tool with malformed arguments."),
    () => toolExecutions === 0,
  );
}

async function vortaToolGuardProof() {
  let toolExecutions = 0;
  const shadow = await createAskVortaSdkShadow({
    model: new ScriptedModel([functionCall()]),
    instructions: "Attempt the fixture tool call.",
    answerSchema,
    toolDefinitions,
    validateToolCall: async () => ({ ok: false, message: "Vorta boundary blocked the call." }),
    executeTool: async () => {
      toolExecutions += 1;
      return { status: "ok" };
    },
    validateOutput: async () => ({ ok: true }),
  });

  await expectReject(
    "Vorta pre-tool guard remains authoritative",
    () => shadow.run("Attempt a blocked tool call."),
    (error) => toolExecutions === 0 && /Vorta boundary blocked/i.test(String(error)),
  );
}

async function vortaOutputGuardProof() {
  const shadow = await createAskVortaSdkShadow({
    model: new ScriptedModel([
      assistantJson({ directAnswer: "Structurally valid but rejected by Vorta." }),
    ]),
    instructions: "Return the structured answer.",
    answerSchema,
    toolDefinitions: [],
    validateToolCall: async () => ({ ok: true }),
    executeTool: async () => ({ status: "ok" }),
    validateOutput: async () => ({ ok: false, message: "Vorta final validator rejected the answer." }),
  });

  await expectReject(
    "Vorta final-output validator remains authoritative",
    () => shadow.run("Return an answer that Vorta will reject."),
    (error) => /Vorta final validator rejected/i.test(String(error)),
  );
}

await validLoopProof();
await malformedArgumentsProof();
await vortaToolGuardProof();
await vortaOutputGuardProof();
console.log("VOR-074 credential-free structural proof PASS.");
