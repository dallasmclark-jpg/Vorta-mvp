const styleId = "vorta-portal-visual-parity";

if (!document.getElementById(styleId)) {
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
html.dark [data-vorta-page-content="true"] :is(.border-gray-800,.border-slate-800){border-color:rgba(148,163,184,.10)!important}
html.dark [data-vorta-page-content="true"] :is(.border-gray-700,.border-slate-700){border-color:rgba(148,163,184,.14)!important}
html.dark [data-vorta-page-content="true"] :is(.divide-gray-800,.divide-slate-800)>:not([hidden])~:not([hidden]){border-color:rgba(148,163,184,.10)!important}
html.dark [data-vorta-page-content="true"] :is(.text-slate-500,.text-gray-500){color:#94a3b8!important}
html.dark [data-vorta-page-content="true"] :is(div,section,article)[class*="rounded-xl"][class*="border-blue"]:is([class*="bg-blue-"],[class*="bg-[#3b82f6"]):not([role="tab"]):not([role="button"]):not([role="status"]):not([role="alert"]):not([aria-selected="true"]){background-color:#030c1d!important;background-image:linear-gradient(180deg,rgba(8,28,52,.30),rgba(3,12,29,0) 58%)!important;box-shadow:var(--vorta-surface-shadow)!important}
html.dark [data-vorta-page-content="true"] :is(div,section,article)[class*="rounded-lg"][class*="border-blue"]:is([class*="bg-blue-"],[class*="bg-[#3b82f6"]):not([role="tab"]):not([role="button"]):not([role="status"]):not([role="alert"]){background-color:#07172b!important;background-image:none!important}
`;
  document.head.append(style);
}
