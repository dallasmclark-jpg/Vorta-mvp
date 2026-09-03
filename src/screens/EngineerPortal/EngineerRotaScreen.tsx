import { OperationalRotaRiskMap } from "../Engineers/OperationalRotaRiskMap";

export function EngineerRotaScreen(): JSX.Element {
  return (
    <div
      data-vorta-page-content="true"
      data-vorta-engineer-rota="true"
      className="flex min-h-full w-full min-w-0 flex-1 flex-col"
    >
      <OperationalRotaRiskMap />
    </div>
  );
}
