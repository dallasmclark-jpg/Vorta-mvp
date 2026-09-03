export function EngineerSearchPillStyles(): JSX.Element {
  return (
    <style>{`
      [data-vorta-engineer-shell="true"] input[placeholder^="Search "] {
        border-radius: 9999px !important;
      }
    `}</style>
  );
}
