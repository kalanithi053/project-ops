"use client";

import { useRouter, usePathname } from "next/navigation";
import { LogOut, Settings, SlidersHorizontal, User } from "lucide-react";

import type { AuthUser } from "@/types/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/lib/store/auth-store";
import { useMe } from "@/lib/api/hooks/use-users";
import { toast } from "@/lib/toast/toast-store";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Account menu in the header. Takes the current user as a prop rather
 * than reading it from a global store, so this component has no
 * dependency on how authentication is ultimately implemented.
 */
export function UserMenu({ user }: { user: AuthUser }) {
  const router = useRouter();
  const pathname = usePathname();
  const clear = useAuthStore((state) => state.clear);
  const { data: me, isLoading } = useMe();
  const workspaceSlug = pathname.split("/").filter(Boolean)[0];

  function logout() {
    clear();
    toast.success("Signed out");
    router.replace("/login");
  }

  function goTo(path: string) {
    if (workspaceSlug) router.push(`/${workspaceSlug}${path}`);
  }

  if (isLoading && !me) {
    return <Skeleton className="h-8 w-8 rounded-full" />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Open user menu"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.avatarUrl} alt={user.name} />
            <AvatarFallback>{initials(user.name)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5 py-2">
          <span className="text-sm font-medium text-foreground">{user.name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">
            {user.email}
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {user.role}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => goTo("/preferences")}>
          <User className="h-4 w-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => goTo("/preferences")}>
          <SlidersHorizontal className="h-4 w-4" />
          Preferences
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => goTo("/settings")}>
          <Settings className="h-4 w-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={logout}
          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
