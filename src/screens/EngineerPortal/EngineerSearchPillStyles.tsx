export function EngineerSearchPillStyles(): JSX.Element {
  return (
    <style>{`
      /* Engineer page search bars are true pills, including inputs without an explicit type attribute. */
      [data-vorta-engineer-shell="true"] input[placeholder^="Search "] {
        border-radius: 9999px !important;
      }
    `}</style>
  );
}
