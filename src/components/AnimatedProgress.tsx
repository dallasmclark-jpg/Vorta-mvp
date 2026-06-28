import { useEffect, useState } from "react";
import { Progress } from "./ui/progress";

interface AnimatedProgressProps {
  value: number;
  className: string;
}

export function AnimatedProgress({ value, className }: AnimatedProgressProps): JSX.Element {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setCurrent(value), 50);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <Progress
      value={current}
      className={`${className} [&>div]:duration-700 [&>div]:ease-out`}
    />
  );
}
