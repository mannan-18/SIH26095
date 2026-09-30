import { Route, Switch, Redirect } from "wouter";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "./_core/hooks/useAuth";
import Login from "./pages/Login";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#EEE9DF]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#FFB162] border-t-transparent" />
          <span className="text-xs text-[#2C3B4D] font-mono font-bold tracking-wider">VERIFYING DOSJE CREDENTIALS...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return <Component />;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="top-right" />
          <Switch>
            {/* Public authentication routes */}
            <Route path="/login" component={Login} />
            <Route path="/dosje-login" component={Login} />
            <Route path="/dosje-login.html" component={Login} />

            {/* Protected dashboard routes */}
            <Route path="/">
              <ProtectedRoute component={Home} />
            </Route>
            <Route path="/dashboard">
              <ProtectedRoute component={Home} />
            </Route>
            <Route path="/home">
              <ProtectedRoute component={Home} />
            </Route>
            <Route path="/inspections">
              <ProtectedRoute component={Home} />
            </Route>
            <Route path="/assignments">
              <ProtectedRoute component={Home} />
            </Route>
            <Route path="/evidence">
              <ProtectedRoute component={Home} />
            </Route>

            {/* Protected fallback for any other app path before 404 */}
            <Route path="/:rest*">
              <ProtectedRoute component={Home} />
            </Route>
          </Switch>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
