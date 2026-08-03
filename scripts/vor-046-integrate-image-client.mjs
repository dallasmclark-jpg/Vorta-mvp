import { readFileSync, writeFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function write(path, source) {
  writeFileSync(path, source);
}

function replaceOnce(source, oldValue, newValue, label) {
  const count = source.split(oldValue).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected exactly one match, found ${count}.`);
  }
  return source.replace(oldValue, newValue);
}

function rangeBetween(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) {
    throw new Error(`${label}: source range could not be located.`);
  }
  return { start, end };
}

function patchAgentService() {
  const path = "src/screens/AiOperations/vortaAgentService.ts";
  let source = read(path);
  if (source.includes("image?: PreparedAskVortaImage;")) {
    console.log("VOR-046 agent-service image integration is already applied.");
    return;
  }

  source = replaceOnce(
    source,
    'import { supabase } from "../../lib/supabaseClient";\n',
    'import { supabase } from "../../lib/supabaseClient";\nimport type { PreparedAskVortaImage } from "./askVortaImageClient";\n',
    "agent image type import",
  );
  source = replaceOnce(
    source,
    "  conversationContext?: VortaConversationContext;\n  pagePath: string;",
    "  conversationContext?: VortaConversationContext;\n  image?: PreparedAskVortaImage;\n  pagePath: string;",
    "agent image request field",
  );
  source = replaceOnce(
    source,
    "  conversationContext,\n  pagePath,\n}: AskVortaAgentInput)",
    "  conversationContext,\n  image,\n  pagePath,\n}: AskVortaAgentInput)",
    "agent image destructuring",
  );
  source = replaceOnce(
    source,
    "        conversationContext,\n        pageContext: {",
    "        conversationContext,\n        image: image\n          ? {\n              name: image.name,\n              mimeType: image.mimeType,\n              dataUrl: image.dataUrl,\n            }\n          : undefined,\n        pageContext: {",
    "agent image request payload",
  );
  write(path, source);
  console.log("Applied VOR-046 agent-service image payload integration.");
}

function patchAssistant() {
  const path = "src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx";
  let source = read(path);
  if (source.includes("const [pendingImage, setPendingImage]")) {
    console.log("VOR-046 compact assistant image integration is already applied.");
    return;
  }

  source = replaceOnce(
    source,
    "  ExternalLink,\n  Loader2,",
    "  ExternalLink,\n  ImagePlus,\n  Loader2,",
    "assistant image icon import",
  );
  source = replaceOnce(
    source,
    'import {\n  AskVortaWorkspace,',
    'import {\n  prepareAskVortaImage,\n  type PreparedAskVortaImage,\n} from "./askVortaImageClient";\nimport {\n  AskVortaWorkspace,',
    "assistant image client import",
  );
  source = replaceOnce(
    source,
    "  retryQuestion?: string;\n}",
    "  retryQuestion?: string;\n  imageName?: string;\n}",
    "assistant message image label",
  );
  source = replaceOnce(
    source,
    '  const [input, setInput] = useState("");\n',
    '  const [input, setInput] = useState("");\n  const [pendingImage, setPendingImage] = useState<PreparedAskVortaImage | null>(null);\n  const [imageError, setImageError] = useState<string | null>(null);\n  const compactImageInputRef = useRef<HTMLInputElement | null>(null);\n',
    "assistant image state",
  );

  const selectionHelper = `
  const selectImageFile = async (
    file: File | null | undefined,
  ): Promise<void> => {
    if (!file) return;
    setImageError(null);
    try {
      const prepared = await prepareAskVortaImage(file);
      setPendingImage(prepared);
    } catch (error) {
      setPendingImage(null);
      setImageError(
        error instanceof Error
          ? error.message
          : "The photo could not be prepared for Ask Vorta.",
      );
    }
  };

  const removePendingImage = (): void => {
    setPendingImage(null);
    setImageError(null);
    if (compactImageInputRef.current) {
      compactImageInputRef.current.value = "";
    }
  };

`;
  const runMarker = "  const runQuestion = async (\n";
  const runIndex = source.indexOf(runMarker);
  if (runIndex < 0) throw new Error("assistant image selection insertion point was not found.");
  source = source.slice(0, runIndex) + selectionHelper + source.slice(runIndex);

  source = replaceOnce(
    source,
    "    history: VortaAgentHistoryItem[],\n  ): Promise<void> => {",
    "    history: VortaAgentHistoryItem[],\n    image?: PreparedAskVortaImage,\n  ): Promise<void> => {",
    "runQuestion image argument",
  );
  source = replaceOnce(
    source,
    "            conversationContext: latestConversationContext(messages),\n            pagePath: window.location.pathname,",
    "            conversationContext: latestConversationContext(messages),\n            image,\n            pagePath: window.location.pathname,",
    "agent image call",
  );
  source = replaceOnce(
    source,
    "          console.warn(\n            \"Ask Vorta agent unavailable; using verified deterministic fallback:\",\n            agentFailureMessage,\n          );\n        }\n      }",
    "          console.warn(\n            \"Ask Vorta agent unavailable; using verified deterministic fallback:\",\n            agentFailureMessage,\n          );\n          if (image) {\n            throw new Error(\n              `${agentFailureMessage} Reattach the photo before retrying; Vorta does not retain image uploads.`,\n            );\n          }\n        }\n      }",
    "block image fallback without vision evidence",
  );
  source = replaceOnce(
    source,
    "                  retryQuestion:\n                    question,",
    "                  retryQuestion:\n                    image ? undefined : question,",
    "image retry requires reattachment",
  );

  const submitRange = rangeBetween(
    source,
    "  const submitQuestion = (\n",
    "\n  const retryFailedQuestion = (",
    "submitQuestion",
  );
  const submitReplacement = `  const submitQuestion = (
    question: string,
  ): void => {
    const trimmed = question.trim();
    const image = pendingImage;
    const effectiveQuestion = trimmed || (
      image
        ? "Identify the visible equipment or fault and give the safest evidence-backed next checks."
        : ""
    );

    if (!effectiveQuestion || !agentContextReady) return;

    stopSpeechRecognition(true);

    const requestId =
      \`${Date.now()}-\${Math.random().toString(36).slice(2, 8)}\`;
    const userId = \`global-user-\${requestId}\`;
    const assistantId = \`global-assistant-\${requestId}\`;

    setMessages((previous) => [
      ...previous,
      {
        id: userId,
        role: "user",
        text: effectiveQuestion,
        imageName: image?.name,
      },
      {
        id: assistantId,
        role: "assistant",
        loading: true,
      },
    ]);

    setInput("");
    setPendingImage(null);
    setImageError(null);
    if (compactImageInputRef.current) {
      compactImageInputRef.current.value = "";
    }

    void runQuestion(
      effectiveQuestion,
      assistantId,
      conversationHistory(messages),
      image ?? undefined,
    );
  };
`;
  source =
    source.slice(0, submitRange.start) +
    submitReplacement +
    source.slice(submitRange.end);

  source = replaceOnce(
    source,
    "    stopSpeechRecognition(true);\n    setInput(\"\");\n    setMessages([",
    "    stopSpeechRecognition(true);\n    setInput(\"\");\n    removePendingImage();\n    setMessages([",
    "new conversation clears photo",
  );

  source = replaceOnce(
    source,
    "        speechError={speechError}\n        promptPlaceholder={roleProfile.promptPlaceholder}",
    "        speechError={speechError}\n        pendingImage={pendingImage}\n        imageError={imageError}\n        onSelectImage={(file) => void selectImageFile(file)}\n        onRemoveImage={removePendingImage}\n        promptPlaceholder={roleProfile.promptPlaceholder}",
    "workspace image props",
  );

  const compactComposerMarker = `          <div
            data-vorta-global-ai-composer="true"
            className="border-t border-gray-800 px-4 py-3 max-md:bg-[#0b0e14] max-md:px-3 max-md:pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          >
            <div`;
  const compactComposerReplacement = `          <div
            data-vorta-global-ai-composer="true"
            className="border-t border-gray-800 px-4 py-3 max-md:bg-[#0b0e14] max-md:px-3 max-md:pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          >
            <input
              ref={compactImageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(event) => {
                const file = event.target.files?.[0];
                void selectImageFile(file);
              }}
            />
            {pendingImage ? (
              <div className="mb-2 hidden items-center gap-3 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 md:flex">
                <img
                  src={pendingImage.dataUrl}
                  alt="Selected maintenance evidence"
                  className="h-10 w-10 rounded-md object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-200">{pendingImage.name}</p>
                  <p className="text-xs text-slate-500">
                    {pendingImage.width} × {pendingImage.height} · Not saved to Vorta records or Recents
                  </p>
                </div>
                <button
                  type="button"
                  onClick={removePendingImage}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
                  aria-label="Remove attached photo"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : null}
            {imageError ? (
              <p className="mb-2 hidden text-xs text-amber-300 md:block" role="alert">{imageError}</p>
            ) : null}
            <div`;
  source = replaceOnce(
    source,
    compactComposerMarker,
    compactComposerReplacement,
    "compact image preview",
  );
  source = replaceOnce(
    source,
    `              <Button
                type="button"
                variant="outline"
                onClick={
                  toggleSpeechRecognition
                }`,
    `              <Button
                type="button"
                variant="outline"
                onClick={() => compactImageInputRef.current?.click()}
                disabled={!agentContextReady}
                aria-label="Attach equipment or fault photo"
                title="Attach one JPEG, PNG or WebP photo"
                className="hidden h-8 w-8 shrink-0 border-gray-700 bg-transparent p-0 text-slate-400 hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-300 md:inline-flex"
              >
                <ImagePlus className="h-3.5 w-3.5" />
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={
                  toggleSpeechRecognition
                }`,
    "compact image button",
  );
  source = replaceOnce(
    source,
    "                  !input.trim() ||\n                  !agentContextReady",
    "                  (!input.trim() && !pendingImage) ||\n                  !agentContextReady",
    "compact image-only submit",
  );
  source = replaceOnce(
    source,
    `                  ) : (
                    <p className="text-xs leading-relaxed">
                      {message.text}
                    </p>
                  )}`,
    `                  ) : (
                    <div className="space-y-1.5">
                      {message.imageName ? (
                        <p className="hidden text-xs font-semibold text-blue-100/80 md:block">
                          Photo attached: {message.imageName}
                        </p>
                      ) : null}
                      <p className="text-xs leading-relaxed">
                        {message.text}
                      </p>
                    </div>
                  )}`,
    "compact user image label",
  );

  write(path, source);
  console.log("Applied VOR-046 compact and workspace image state integration.");
}

function patchWorkspace() {
  const path = "src/screens/AiOperations/AskVortaWorkspace.tsx";
  let source = read(path);
  if (source.includes("pendingImage: PreparedAskVortaImage | null;")) {
    console.log("VOR-046 workspace image integration is already applied.");
    return;
  }

  source = replaceOnce(
    source,
    "  FileSearch,\n  ListChecks,",
    "  FileSearch,\n  ImagePlus,\n  ListChecks,",
    "workspace image icon",
  );
  source = replaceOnce(
    source,
    'import { Button } from "../../components/ui/button";\n',
    'import { Button } from "../../components/ui/button";\nimport type { PreparedAskVortaImage } from "./askVortaImageClient";\n',
    "workspace image type import",
  );
  source = replaceOnce(
    source,
    "  retryQuestion?: string;\n}",
    "  retryQuestion?: string;\n  imageName?: string;\n}",
    "workspace message image label",
  );
  source = replaceOnce(
    source,
    "  speechError: string | null;\n  promptPlaceholder: string;",
    "  speechError: string | null;\n  pendingImage: PreparedAskVortaImage | null;\n  imageError: string | null;\n  onSelectImage: (file: File) => void;\n  onRemoveImage: () => void;\n  promptPlaceholder: string;",
    "workspace image props type",
  );
  source = replaceOnce(
    source,
    "  speechError,\n  promptPlaceholder,",
    "  speechError,\n  pendingImage,\n  imageError,\n  onSelectImage,\n  onRemoveImage,\n  promptPlaceholder,",
    "workspace image props destructuring",
  );
  source = replaceOnce(
    source,
    `                    ) : (
                      <p className="text-sm leading-6">{message.text}</p>
                    )}`,
    `                    ) : (
                      <div className="space-y-2">
                        {message.imageName ? (
                          <p className="text-xs font-semibold text-blue-100/80">
                            Photo attached: {message.imageName}
                          </p>
                        ) : null}
                        <p className="text-sm leading-6">{message.text}</p>
                      </div>
                    )}`,
    "workspace user image label",
  );

  const workspaceComposerMarker = `          <div className="shrink-0 border-t border-gray-800 bg-gray-950 px-6 py-4">
            <div className="mx-auto max-w-4xl">
              <div className="flex gap-2 rounded-xl border border-gray-700 bg-gray-900 p-2 focus-within:border-blue-500/50">`;
  const workspaceComposerReplacement = `          <div className="shrink-0 border-t border-gray-800 bg-gray-950 px-6 py-4">
            <div className="mx-auto max-w-4xl">
              {pendingImage ? (
                <div className="mb-3 flex items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2.5">
                  <img
                    src={pendingImage.dataUrl}
                    alt="Selected maintenance evidence"
                    className="h-12 w-12 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-200">{pendingImage.name}</p>
                    <p className="text-xs text-slate-500">
                      {pendingImage.width} × {pendingImage.height} · Analyzed once and not saved to Vorta records or Recent conversations
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onRemoveImage}
                    className="rounded-md p-2 text-slate-400 hover:bg-white/10 hover:text-white"
                    aria-label="Remove attached photo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
              {imageError ? (
                <p className="mb-2 text-xs text-amber-300" role="alert">{imageError}</p>
              ) : null}
              <div className="flex gap-2 rounded-xl border border-gray-700 bg-gray-900 p-2 focus-within:border-blue-500/50">`;
  source = replaceOnce(
    source,
    workspaceComposerMarker,
    workspaceComposerReplacement,
    "workspace image preview",
  );
  source = replaceOnce(
    source,
    `                <Button
                  type="button"
                  variant="outline"
                  onClick={onToggleSpeech}`,
    `                <label
                  className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md border border-gray-700 bg-transparent text-slate-400 transition-colors hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-300"
                  aria-label="Attach equipment or fault photo"
                  title="Attach one JPEG, PNG or WebP photo"
                >
                  <ImagePlus className="h-4 w-4" />
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) onSelectImage(file);
                      event.target.value = "";
                    }}
                  />
                </label>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onToggleSpeech}`,
    "workspace image button",
  );
  source = replaceOnce(
    source,
    "                  disabled={!input.trim() || !contextReady}",
    "                  disabled={(!input.trim() && !pendingImage) || !contextReady}",
    "workspace image-only submit",
  );

  write(path, source);
  console.log("Applied VOR-046 workspace image attachment integration.");
}

patchAgentService();
patchAssistant();
patchWorkspace();
