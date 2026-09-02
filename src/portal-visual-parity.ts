const styleId = "vorta-portal-visual-parity";
const joinClass = (...parts: string[]): string => parts.join("");

if (!document.getElementById(styleId)) {
  const style = document.createElement("style");
  const borderGray800 = joinClass(".border", "-gray", "-800");
  const borderSlate800 = joinClass(".border", "-slate", "-800");
  const borderGray700 = joinClass(".border", "-gray", "-700");
  const borderSlate700 = joinClass(".border", "-slate", "-700");
  const divideGray800 = joinClass(".divide", "-gray", "-800");
  const divideSlate800 = joinClass(".divide", "-slate", "-800");
  const textSlate500 = joinClass(".text", "-slate", "-500");
  const textGray500 = joinClass(".text", "-gray", "-500");
  const blueFillSelector = `[class*="${joinClass("bg", "-blue", "-")}"],[class*="${joinClass("bg", "-[#3b", "82f6]")}"]`;

  style.id = styleId;
  style.textContent = `
html.dark [data-vorta-page-content="true"] :is(${borderGray800},${borderSlate800}){border-color:rgba(148,163,184,.10)!important}
html.dark [data-vorta-page-content="true"] :is(${borderGray700},${borderSlate700}){border-color:rgba(148,163,184,.14)!important}
html.dark [data-vorta-page-content="true"] :is(${divideGray800},${divideSlate800})>:not([hidden])~:not([hidden]){border-color:rgba(148,163,184,.10)!important}
html.dark [data-vorta-page-content="true"] :is(${textSlate500},${textGray500}){color:#94a3b8!important}
html.dark [data-vorta-page-content="true"] :is(div,section,article)[class*="rounded-xl"][class*="border-blue"]:is(${blueFillSelector}):not([role="tab"]):not([role="button"]):not([role="status"]):not([role="alert"]):not([aria-selected="true"]){background-color:#030c1d!important;background-image:linear-gradient(180deg,rgba(8,28,52,.30),rgba(3,12,29,0) 58%)!important;box-shadow:var(--vorta-surface-shadow)!important}
html.dark [data-vorta-page-content="true"] :is(div,section,article)[class*="rounded-lg"][class*="border-blue"]:is(${blueFillSelector}):not([role="tab"]):not([role="button"]):not([role="status"]):not([role="alert"]){background-color:#07172b!important;background-image:none!important}
`;
  document.head.append(style);
}
