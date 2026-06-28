import { useLocation } from "react-router-dom";

interface PageTransitionProps {
  children: React.ReactNode;
}

export const PageTransition = ({ children }: PageTransitionProps): JSX.Element => {
  const { pathname } = useLocation();
  return (
    <div key={pathname} className="animate-fade-in min-w-0 w-full max-w-full overflow-x-hidden">
      {children}
    </div>
  );
};
