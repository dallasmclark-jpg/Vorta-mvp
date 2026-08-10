const ASK_VORTA_WORKSPACE_FOCUS_STYLE_ID = "vorta-ask-vorta-workspace-focus-guard";

export function installAskVortaWorkspaceFocusGuard(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(ASK_VORTA_WORKSPACE_FOCUS_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = ASK_VORTA_WORKSPACE_FOCUS_STYLE_ID;
  style.textContent = `
    [data-vorta-ai-workspace="true"] [data-vorta-ai-workspace-input="true"],
    [data-vorta-ai-workspace="true"] [data-vorta-ai-workspace-input="true"]:focus,
    [data-vorta-ai-workspace="true"] [data-vorta-ai-workspace-input="true"]:focus-visible {
      border: 0 !important;
      outline: none !important;
      box-shadow: none !important;
    }

    [data-vorta-ai-workspace="true"] div:has(> [data-vorta-ai-workspace-input="true"]):focus-within {
      border-color: rgb(55 65 81) !important;
    }
  `;
  document.head.appendChild(style);
}
