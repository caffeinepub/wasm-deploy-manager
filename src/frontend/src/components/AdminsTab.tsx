import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useAddAdmin,
  useGetAdmins,
  useGetOwner,
  useRemoveAdmin,
} from "@/hooks/useQueries";
import { Principal } from "@dfinity/principal";
import type { Principal as PrincipalType } from "@dfinity/principal";
import { Loader2, ShieldAlert, Trash2, UserPlus, Users } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";

interface AdminsTabProps {
  callerPrincipal: string | null;
}

export function AdminsTab({ callerPrincipal }: AdminsTabProps) {
  const [newPrincipal, setNewPrincipal] = useState("");
  const { data: admins, isLoading: adminsLoading } = useGetAdmins();
  const { data: owner } = useGetOwner();
  const addAdminMutation = useAddAdmin();
  const removeAdminMutation = useRemoveAdmin();

  const ownerText = owner ? (owner as PrincipalType).toText() : null;
  const isOwner = callerPrincipal && ownerText && callerPrincipal === ownerText;

  const handleAdd = async () => {
    if (!newPrincipal.trim()) {
      toast.error("Enter a principal ID");
      return;
    }
    try {
      const principal = Principal.fromText(newPrincipal.trim());
      await addAdminMutation.mutateAsync(principal);
      setNewPrincipal("");
      toast.success("Admin added!");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Failed: ${msg}`);
    }
  };

  const handleRemove = async (principal: PrincipalType, index: number) => {
    try {
      await removeAdminMutation.mutateAsync(principal);
      toast.success("Admin removed");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Failed: ${msg}`);
    }
    // Suppress unused variable warning
    void index;
  };

  if (!isOwner) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg border border-border bg-card p-8 text-center space-y-3"
      >
        <ShieldAlert className="w-8 h-8 text-muted-foreground mx-auto" />
        <h3 className="font-display text-base font-semibold">
          Owner Access Required
        </h3>
        <p className="text-sm text-muted-foreground">
          Only the canister owner can manage the admin whitelist.
        </p>
        {ownerText && (
          <p className="text-xs text-muted-foreground font-mono">
            Owner: <span className="text-primary">{ownerText}</span>
          </p>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="space-y-6"
    >
      {/* Add Admin */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-primary" />
          <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Add Admin
          </h2>
        </div>
        <div className="flex gap-2">
          <Input
            data-ocid="admins.add_principal.input"
            placeholder="Principal ID (e.g. aaaaa-aa)"
            value={newPrincipal}
            onChange={(e) => setNewPrincipal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="font-mono text-sm bg-input border-border flex-1"
          />
          <Button
            data-ocid="admins.add.button"
            onClick={handleAdd}
            disabled={addAdminMutation.isPending || !newPrincipal.trim()}
            className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
          >
            {addAdminMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <UserPlus className="w-4 h-4 mr-2" />
                Add
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Admin List */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-border">
          <Users className="w-4 h-4 text-primary" />
          <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Admins
          </h2>
          {admins && (
            <Badge
              variant="outline"
              className="ml-auto font-mono text-xs border-border text-muted-foreground"
            >
              {admins.length}
            </Badge>
          )}
        </div>

        {adminsLoading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-10 w-full bg-muted" />
            <Skeleton className="h-10 w-full bg-muted" />
            <Skeleton className="h-10 w-full bg-muted" />
          </div>
        ) : !admins || admins.length === 0 ? (
          <div
            data-ocid="admins.list.empty_state"
            className="p-8 text-center text-sm text-muted-foreground font-mono"
          >
            No admins yet — add the first one above
          </div>
        ) : (
          <Table data-ocid="admins.list.table">
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground font-mono text-xs">
                  Principal ID
                </TableHead>
                <TableHead className="text-muted-foreground font-mono text-xs w-24">
                  Role
                </TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.map((admin, idx) => {
                const adminText = (admin as PrincipalType).toText();
                const isAdminOwner = adminText === ownerText;
                const rowNum = idx + 1;
                return (
                  <TableRow
                    key={adminText}
                    data-ocid={`admins.list.row.${rowNum}` as string}
                    className="border-border hover:bg-secondary/50"
                  >
                    <TableCell className="font-mono text-xs text-primary truncate max-w-xs">
                      {adminText}
                    </TableCell>
                    <TableCell>
                      {isAdminOwner ? (
                        <Badge className="bg-primary/20 text-primary border-primary/30 text-xs font-mono">
                          owner
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-border text-muted-foreground text-xs font-mono"
                        >
                          admin
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        data-ocid={
                          `admins.remove.delete_button.${rowNum}` as string
                        }
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleRemove(admin as PrincipalType, idx)
                        }
                        disabled={isAdminOwner || removeAdminMutation.isPending}
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-30"
                        title={
                          isAdminOwner ? "Cannot remove owner" : "Remove admin"
                        }
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </motion.div>
  );
}
