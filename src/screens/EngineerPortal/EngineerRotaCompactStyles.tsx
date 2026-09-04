export function EngineerRotaCompactStyles(): JSX.Element {
  return (
    <style>{`
      [data-vorta-engineer-rota="true"] > div > header {
        display: none !important;
      }

      [data-vorta-engineer-rota="true"] section[aria-busy] > div:first-child {
        display: none !important;
      }

      [data-vorta-engineer-rota="true"] > div {
        padding-top: 0.5rem !important;
        gap: 0.5rem !important;
      }
    `}</style>
  );
}
