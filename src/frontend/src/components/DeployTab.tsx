import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { loadConfig } from "@/config";
import { useGetWasm, useStoreWasm } from "@/hooks/useQueries";
import {
  createMockWasm,
  installCode,
  verifyOwnership,
} from "@/utils/managementCanister";
import { Principal } from "@dfinity/principal";
import type { Identity } from "@icp-sdk/core/agent";
import { HttpAgent } from "@icp-sdk/core/agent";
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  Cpu,
  Download,
  Loader2,
  Rocket,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

const EXAMPLE_MOTOKO = `actor {
  private var counter : Nat = 0;

  public query func get() : async Nat {
    counter
  };

  public func increment() : async Nat {
    counter += 1;
    counter
  };

  public func reset() : async () {
    counter := 0;
  };
}`;

type OwnershipState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "verified" }
  | { status: "failed"; error: string };

type CompileState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; size: number }
  | { status: "error"; error: string };

type DeployState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success" }
  | { status: "error"; error: string };

interface DeployTabProps {
  identity: Identity | undefined;
}

export function DeployTab({ identity }: DeployTabProps) {
  const [canisterId, setCanisterId] = useState("");
  const [ownership, setOwnership] = useState<OwnershipState>({
    status: "idle",
  });
  const [sourceCode, setSourceCode] = useState(EXAMPLE_MOTOKO);
  const [compileState, setCompileState] = useState<CompileState>({
    status: "idle",
  });
  const [deployMode, setDeployMode] = useState<
    "install" | "reinstall" | "upgrade"
  >("install");
  const [deployState, setDeployState] = useState<DeployState>({
    status: "idle",
  });
  const [localWasm, setLocalWasm] = useState<Uint8Array | null>(null);

  const { data: storedWasm } = useGetWasm();
  const storeWasmMutation = useStoreWasm();

  const activeWasm = localWasm ?? (storedWasm ? storedWasm.wasm : null);

  const buildAgent = useCallback(async () => {
    const config = await loadConfig();
    const agent = new HttpAgent({
      identity,
      host: config.backend_host,
    });
    if (config.backend_host?.includes("localhost")) {
      await agent.fetchRootKey().catch(() => {});
    }
    return agent;
  }, [identity]);

  const handleVerify = useCallback(async () => {
    if (!canisterId.trim()) {
      toast.error("Enter a canister ID first");
      return;
    }
    if (!identity) {
      toast.error("Not authenticated");
      return;
    }
    setOwnership({ status: "loading" });
    try {
      const principal = Principal.fromText(canisterId.trim());
      const callerPrincipal = identity.getPrincipal();
      const agent = await buildAgent();
      const result = await verifyOwnership(agent, principal, callerPrincipal);
      if (result.verified) {
        setOwnership({ status: "verified" });
        toast.success("Canister ownership verified!");
      } else {
        setOwnership({
          status: "failed",
          error: result.error ?? "Not a controller",
        });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setOwnership({ status: "failed", error: msg });
    }
  }, [canisterId, identity, buildAgent]);

  const handleCompile = useCallback(async () => {
    if (!sourceCode.trim()) {
      toast.error("Enter Motoko source code first");
      return;
    }
    setCompileState({ status: "loading" });
    try {
      const response = await fetch(
        "https://m7sm4-2iaaa-aaaab-qabra-cai.raw.ic0.app/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: sourceCode }),
        },
      );
      if (response.ok) {
        const data = await response.arrayBuffer();
        const wasmBytes = new Uint8Array(data);
        const storeResult = await storeWasmMutation.mutateAsync(wasmBytes);
        if (storeResult.__kind__ === "ok") {
          setLocalWasm(wasmBytes);
          setCompileState({ status: "success", size: wasmBytes.byteLength });
          toast.success("Code compiled and stored!");
        } else {
          setCompileState({ status: "error", error: "Failed to store WASM" });
        }
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch {
      setCompileState({
        status: "error",
        error:
          "Compilation requires the deployed backend. Download the Motoko source and compile locally, or deploy the app to use remote compilation.",
      });
    }
  }, [sourceCode, storeWasmMutation]);

  const handleUseMockWasm = useCallback(async () => {
    setCompileState({ status: "loading" });
    try {
      const mock = createMockWasm();
      const storeResult = await storeWasmMutation.mutateAsync(mock);
      if (storeResult.__kind__ === "ok") {
        setLocalWasm(mock);
        setCompileState({ status: "success", size: mock.byteLength });
        toast.success("Mock WASM stored for demo");
      } else {
        setCompileState({
          status: "error",
          error: "Failed to store mock WASM",
        });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setCompileState({ status: "error", error: msg });
    }
  }, [storeWasmMutation]);

  const handleDownload = useCallback(() => {
    const wasm = activeWasm;
    if (!wasm) return;
    const blob = new Blob([wasm.buffer as ArrayBuffer], {
      type: "application/wasm",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "canister.wasm";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("WASM downloaded!");
  }, [activeWasm]);

  const handleDeploy = useCallback(async () => {
    if (!canisterId.trim() || ownership.status !== "verified") {
      toast.error("Verify canister ownership first");
      return;
    }
    if (!activeWasm) {
      toast.error("No WASM available \u2014 compile first");
      return;
    }
    if (!identity) {
      toast.error("Not authenticated");
      return;
    }
    setDeployState({ status: "loading" });
    try {
      const principal = Principal.fromText(canisterId.trim());
      const agent = await buildAgent();
      await installCode(agent, principal, activeWasm, deployMode);
      setDeployState({ status: "success" });
      toast.success("Code deployed successfully!");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setDeployState({ status: "error", error: msg });
      toast.error(`Deploy failed: ${msg}`);
    }
  }, [
    canisterId,
    ownership.status,
    activeWasm,
    identity,
    deployMode,
    buildAgent,
  ]);

  const wasmSize = activeWasm ? activeWasm.byteLength : null;
  const compiledAt = storedWasm?.compiledAt
    ? new Date(Number(storedWasm.compiledAt / 1_000_000n)).toLocaleString()
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="space-y-6"
    >
      {/* Step 1: Canister Verification */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Step 1 \u2014 Verify Ownership
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Enter the canister ID you own. We'll confirm you're listed as a
          controller before allowing deployment.
        </p>
        <div className="flex gap-2">
          <Input
            data-ocid="deploy.canister_id.input"
            placeholder="e.g. rrkah-fqaaa-aaaaa-aaaaq-cai"
            value={canisterId}
            onChange={(e) => {
              setCanisterId(e.target.value);
              setOwnership({ status: "idle" });
            }}
            className="font-mono text-sm bg-input border-border flex-1"
          />
          <Button
            data-ocid="deploy.verify_ownership.button"
            onClick={handleVerify}
            disabled={ownership.status === "loading" || !canisterId.trim()}
            variant="outline"
            className="border-primary/40 text-primary hover:bg-primary/10 shrink-0"
          >
            {ownership.status === "loading" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Verify"
            )}
          </Button>
        </div>

        <AnimatePresence mode="wait">
          {ownership.status === "verified" && (
            <motion.div
              key="ok"
              data-ocid="deploy.ownership.success_state"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 text-primary text-sm font-mono"
            >
              <CheckCircle2 className="w-4 h-4" />
              You are a verified controller
            </motion.div>
          )}
          {ownership.status === "failed" && (
            <motion.div
              key="err"
              data-ocid="deploy.ownership.error_state"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-start gap-2 text-destructive text-sm"
            >
              <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span className="font-mono">{ownership.error}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Step 2: Motoko Source Code */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Code2 className="w-4 h-4 text-primary" />
          <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Step 2 \u2014 Motoko Source Code
          </h2>
        </div>
        <Label htmlFor="motoko-code" className="text-xs text-muted-foreground">
          Paste your Motoko actor code below
        </Label>
        <Textarea
          id="motoko-code"
          data-ocid="deploy.code.textarea"
          value={sourceCode}
          onChange={(e) => setSourceCode(e.target.value)}
          className="code-area min-h-64 resize-y text-foreground placeholder:text-muted-foreground/40"
          spellCheck={false}
        />

        <div className="flex flex-wrap gap-2">
          <Button
            data-ocid="deploy.compile.button"
            onClick={handleCompile}
            disabled={compileState.status === "loading"}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {compileState.status === "loading" ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Compiling\u2026
              </>
            ) : (
              <>
                <Cpu className="w-4 h-4 mr-2" />
                Compile
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleUseMockWasm}
            disabled={compileState.status === "loading"}
            className="border-border text-muted-foreground hover:text-foreground"
          >
            Use Mock WASM (Demo)
          </Button>
        </div>

        <AnimatePresence mode="wait">
          {compileState.status === "loading" && (
            <motion.div
              key="compile-loading"
              data-ocid="deploy.compile.loading_state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-muted-foreground text-sm font-mono"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              Sending to compiler\u2026
            </motion.div>
          )}
          {compileState.status === "success" && (
            <motion.div
              key="compile-ok"
              data-ocid="deploy.compile.success_state"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-primary text-sm font-mono"
            >
              <CheckCircle2 className="w-4 h-4" />
              Compiled \u2014 {compileState.size.toLocaleString()} bytes
            </motion.div>
          )}
          {compileState.status === "error" && (
            <motion.div
              key="compile-err"
              data-ocid="deploy.compile.error_state"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-md border border-destructive/30 bg-destructive/10 p-3 flex items-start gap-2 text-destructive text-sm"
            >
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{compileState.error}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Step 3: WASM + Deploy */}
      <AnimatePresence>
        {(activeWasm || storedWasm) && (
          <motion.div
            key="wasm-section"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-lg border border-primary/30 bg-card p-6 space-y-5"
            style={{ boxShadow: "0 0 30px oklch(0.82 0.17 152 / 0.06)" }}
          >
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Rocket className="w-4 h-4 text-primary" />
                <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  Step 3 \u2014 WASM Ready
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {wasmSize && (
                  <Badge
                    variant="outline"
                    className="font-mono text-xs border-primary/30 text-primary"
                  >
                    {(wasmSize / 1024).toFixed(1)} KB
                  </Badge>
                )}
                {compiledAt && (
                  <Badge
                    variant="outline"
                    className="font-mono text-xs border-border text-muted-foreground"
                  >
                    {compiledAt}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  Deploy Mode
                </Label>
                <Select
                  value={deployMode}
                  onValueChange={(v) => setDeployMode(v as typeof deployMode)}
                >
                  <SelectTrigger
                    data-ocid="deploy.deploy_mode.select"
                    className="w-36 bg-input border-border font-mono text-sm"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="install">install</SelectItem>
                    <SelectItem value="reinstall">reinstall</SelectItem>
                    <SelectItem value="upgrade">upgrade</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                data-ocid="deploy.wasm.download_button"
                variant="outline"
                onClick={handleDownload}
                className="border-border text-foreground hover:bg-secondary"
              >
                <Download className="w-4 h-4 mr-2" />
                Download WASM
              </Button>

              <Button
                data-ocid="deploy.deploy.button"
                onClick={handleDeploy}
                disabled={
                  ownership.status !== "verified" ||
                  deployState.status === "loading"
                }
                className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
              >
                {deployState.status === "loading" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Deploying\u2026
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4 mr-2" />
                    Deploy to Canister
                  </>
                )}
              </Button>
            </div>

            {ownership.status !== "verified" && (
              <p className="text-xs text-muted-foreground font-mono">
                \u2191 Verify ownership above to enable deployment
              </p>
            )}

            <AnimatePresence mode="wait">
              {deployState.status === "loading" && (
                <motion.div
                  key="deploy-loading"
                  data-ocid="deploy.deploy.loading_state"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 text-muted-foreground text-sm font-mono"
                >
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Installing code on canister\u2026
                </motion.div>
              )}
              {deployState.status === "success" && (
                <motion.div
                  key="deploy-ok"
                  data-ocid="deploy.deploy.success_state"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-md border border-primary/30 bg-primary/10 p-3 flex items-center gap-2 text-primary text-sm font-mono"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Deployment successful \u2014 canister updated!
                </motion.div>
              )}
              {deployState.status === "error" && (
                <motion.div
                  key="deploy-err"
                  data-ocid="deploy.deploy.error_state"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-md border border-destructive/30 bg-destructive/10 p-3 flex items-start gap-2 text-destructive text-sm"
                >
                  <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span className="font-mono">{deployState.error}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
