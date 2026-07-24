import { useLocation } from "react-router-dom";
import { ThemeControl } from "./ThemeControl";

interface PageTransitionProps {
  children: React.ReactNode;
}

export const PageTransition = ({ children }: PageTransitionProps): JSX.Element => {
  const { pathname } = useLocation();

  return (
    <>
      <div key={pathname} className="min-w-0 w-full max-w-full overflow-x-hidden">
        {children}
      </div>
      <ThemeControl />
    </>
  );
};
