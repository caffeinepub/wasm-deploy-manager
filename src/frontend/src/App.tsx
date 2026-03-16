import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  Check,
  Copy,
  Cpu,
  LogIn,
  LogOut,
  Rocket,
  Shield,
  Terminal,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { AdminsTab } from "./components/AdminsTab";
import { DeployTab } from "./components/DeployTab";
import { useActor } from "./hooks/useActor";
import { useInternetIdentity } from "./hooks/useInternetIdentity";
import { useIsAdmin } from "./hooks/useQueries";

function CopyPrincipal({ principal }: { principal: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(principal).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1.5 font-mono text-xs text-primary bg-primary/10 border border-primary/20 rounded px-2.5 py-1.5 hover:bg-primary/20 transition-colors"
      title="Copy principal"
    >
      <span className="truncate max-w-48 md:max-w-80">{principal}</span>
      {copied ? (
        <Check className="w-3 h-3 shrink-0" />
      ) : (
        <Copy className="w-3 h-3 shrink-0" />
      )}
    </button>
  );
}

export default function App() {
  const {
    identity,
    login,
    clear,
    isLoggingIn,
    isLoginSuccess,
    isInitializing,
  } = useInternetIdentity();
  const { isFetching: actorFetching, actor } = useActor();
  const {
    data: isAdmin,
    isLoading: roleLoading,
    isError: roleError,
  } = useIsAdmin();

  const [activeTab, setActiveTab] = useState("deploy");
  const callerPrincipal = identity?.getPrincipal().toText() ?? null;
  const isAuthenticated = isLoginSuccess || !!identity;

  // Show loading while initializing, while actor is being fetched,
  // or while role is being determined (including when isAdmin is still undefined).
  const isLoading =
    isInitializing ||
    (isAuthenticated &&
      (actorFetching || roleLoading || (!!actor && isAdmin === undefined)));

  // Actor failed to initialize (e.g. network error)
  const hasActorError = isAuthenticated && !actorFetching && !actor;

  return (
    <div className="min-h-screen flex flex-col">
      <Toaster
        position="top-right"
        toastOptions={{
          className: "!bg-card !border-border !text-foreground !font-mono",
        }}
      />

      {/* Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto max-w-4xl px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Terminal className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="font-display font-bold text-base tracking-tight">
              MotoDeploy
            </span>
            <Badge
              variant="outline"
              className="hidden sm:flex text-[10px] font-mono border-primary/30 text-primary/70"
            >
              ICP
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated && callerPrincipal && (
              <CopyPrincipal principal={callerPrincipal} />
            )}
            {isAuthenticated ? (
              <Button
                data-ocid="auth.logout.button"
                variant="ghost"
                size="sm"
                onClick={clear}
                className="text-muted-foreground hover:text-foreground gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            ) : (
              <Button
                data-ocid="auth.login.button"
                size="sm"
                onClick={login}
                disabled={isLoggingIn}
                className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
              >
                {isLoggingIn ? (
                  <Cpu className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <LogIn className="w-3.5 h-3.5" />
                )}
                Login
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto max-w-4xl px-4 py-8">
        <AnimatePresence mode="wait">
          {/* Loading state */}
          {isLoading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <Skeleton className="h-12 w-48 bg-muted" />
              <Skeleton className="h-32 w-full bg-muted" />
              <Skeleton className="h-64 w-full bg-muted" />
            </motion.div>
          )}

          {/* Actor / network error */}
          {!isLoading && (hasActorError || roleError) && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="py-20 flex flex-col items-center text-center space-y-4"
            >
              <div className="w-14 h-14 rounded-2xl border border-destructive/30 bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <h2 className="font-display text-xl font-bold">
                Connection Error
              </h2>
              <p className="text-muted-foreground text-sm max-w-sm">
                Could not connect to the backend canister. Check your network
                connection and try again.
              </p>
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
                className="border-border text-foreground"
              >
                Reload
              </Button>
            </motion.div>
          )}

          {/* Not logged in */}
          {!isLoading && !isAuthenticated && (
            <motion.div
              key="login"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="py-20 flex flex-col items-center text-center space-y-8"
            >
              <div className="relative">
                <div
                  className="w-20 h-20 rounded-2xl border border-primary/30 bg-primary/10 flex items-center justify-center"
                  style={{ boxShadow: "0 0 40px oklch(0.87 0.28 130 / 0.15)" }}
                >
                  <Rocket className="w-9 h-9 text-primary" />
                </div>
              </div>

              <div className="space-y-3">
                <h1 className="font-display text-4xl font-bold tracking-tight">
                  MotoDeploy
                </h1>
                <p className="text-muted-foreground text-lg max-w-md">
                  Deploy Motoko code to your ICP canisters \u2014 no{" "}
                  <span className="font-mono text-primary">dfx</span> required.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl w-full text-left">
                {[
                  {
                    icon: Shield,
                    title: "You stay in control",
                    desc: "We never take ownership of your canister.",
                  },
                  {
                    icon: Cpu,
                    title: "Compile & deploy",
                    desc: "Paste Motoko code and deploy in one click.",
                  },
                  {
                    icon: Rocket,
                    title: "Full sovereignty",
                    desc: "Download the WASM and deploy anywhere.",
                  },
                ].map(({ icon: Icon, title, desc }) => (
                  <div
                    key={title}
                    className="rounded-lg border border-border bg-card p-4 space-y-1"
                  >
                    <Icon className="w-4 h-4 text-primary mb-2" />
                    <p className="text-sm font-semibold font-display">
                      {title}
                    </p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                ))}
              </div>

              <Button
                data-ocid="auth.login.button"
                size="lg"
                onClick={login}
                disabled={isLoggingIn}
                className="bg-primary text-primary-foreground hover:bg-primary/90 text-base px-8 py-6 gap-2"
                style={{ boxShadow: "0 0 30px oklch(0.87 0.28 130 / 0.25)" }}
              >
                {isLoggingIn ? (
                  <Cpu className="w-5 h-5 animate-spin" />
                ) : (
                  <LogIn className="w-5 h-5" />
                )}
                Sign in with Internet Identity
              </Button>

              <p className="text-xs text-muted-foreground">
                No passwords. No accounts. Powered by ICP's native identity
                system.
              </p>
            </motion.div>
          )}

          {/* Logged in, not admin */}
          {!isLoading &&
            !hasActorError &&
            !roleError &&
            isAuthenticated &&
            isAdmin === false && (
              <motion.div
                key="restricted"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="py-20 flex flex-col items-center text-center space-y-6"
              >
                <div className="w-16 h-16 rounded-2xl border border-destructive/30 bg-destructive/10 flex items-center justify-center">
                  <Shield className="w-7 h-7 text-destructive" />
                </div>
                <div className="space-y-2">
                  <h2 className="font-display text-2xl font-bold">
                    Access Restricted
                  </h2>
                  <p className="text-muted-foreground max-w-sm">
                    Your principal is not on the admin whitelist. Ask the owner
                    to add you.
                  </p>
                </div>
                {callerPrincipal && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">
                      Your principal ID:
                    </p>
                    <CopyPrincipal principal={callerPrincipal} />
                  </div>
                )}
              </motion.div>
            )}

          {/* Logged in, is admin */}
          {!isLoading &&
            !hasActorError &&
            !roleError &&
            isAuthenticated &&
            isAdmin === true && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              >
                <div className="mb-6">
                  <h1 className="font-display text-2xl font-bold tracking-tight mb-1">
                    MotoDeploy
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Compile, verify, and deploy Motoko code to your canister.
                  </p>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="bg-secondary border border-border mb-6">
                    <TabsTrigger
                      data-ocid="deploy.tab"
                      value="deploy"
                      className="font-mono text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5"
                    >
                      <Rocket className="w-3.5 h-3.5" />
                      Deploy
                    </TabsTrigger>
                    <TabsTrigger
                      data-ocid="admins.tab"
                      value="admins"
                      className="font-mono text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5"
                    >
                      <Shield className="w-3.5 h-3.5" />
                      Admins
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="deploy" className="mt-0">
                    <DeployTab identity={identity} />
                  </TabsContent>

                  <TabsContent value="admins" className="mt-0">
                    <AdminsTab callerPrincipal={callerPrincipal} />
                  </TabsContent>
                </Tabs>
              </motion.div>
            )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4 mt-auto">
        <div className="container mx-auto max-w-4xl px-4 flex items-center justify-center">
          <p className="text-xs text-muted-foreground">
            \u00a9 {new Date().getFullYear()}. Built with \u2665 using{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              caffeine.ai
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
