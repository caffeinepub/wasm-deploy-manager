import type { Principal } from "@dfinity/principal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useActor } from "./useActor";

export function useIsAdmin() {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["isCallerAdmin"],
    queryFn: async () => {
      if (!actor) return false;
      try {
        return await actor.isCallerAdmin();
      } catch {
        return false;
      }
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetOwner() {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["owner"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getOwner();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetAdmins() {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["admins"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAdmins();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetWasm() {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["wasm"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getWasm();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAddAdmin() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (principal: Principal) => {
      if (!actor) throw new Error("Not connected");
      const result = await actor.addAdmin(principal);
      if (result.__kind__ === "err") throw new Error(result.err);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admins"] });
    },
  });
}

export function useRemoveAdmin() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (principal: Principal) => {
      if (!actor) throw new Error("Not connected");
      const result = await actor.removeAdmin(principal);
      if (result.__kind__ === "err") throw new Error(result.err);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admins"] });
    },
  });
}

export function useStoreWasm() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (wasm: Uint8Array) => {
      if (!actor) throw new Error("Not connected");
      const result = await actor.storeWasm(wasm);
      if (result.__kind__ === "err") throw new Error(result.err);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wasm"] });
    },
  });
}
