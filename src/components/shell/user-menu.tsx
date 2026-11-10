import { getCurrentUser } from "@/lib/dal";
import { capabilityLabel } from "@/lib/domain";
import { isHybrid } from "@/lib/permissions";
import { isDemoMode, personaByEmail } from "@/lib/personas";
import { Avatar, Badge } from "@/components/ui";
import { RoleSwitcher } from "./role-switcher";
import { SignOutButton } from "./sign-out-button";

export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) return null;
  const persona = isDemoMode() ? personaByEmail(user.email) : undefined;
  const roleText = isHybrid(user)
    ? "Hybrid Broker / AE"
    : user.capabilities.filter((c) => c !== "ADMIN").map((c) => capabilityLabel[c]).join(" · ");

  if (persona) {
    return (
      <div className="flex items-center gap-3">
        <RoleSwitcher current={persona.key} />
        <Avatar name={user.name} className="size-8 text-xs" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right leading-tight sm:block">
        <div className="font-medium text-slate-900">{user.name}</div>
        <div className="text-xs text-slate-500">{user.title ?? roleText}</div>
      </div>
      <Badge tone={isHybrid(user) ? "violet" : "blue"} className="hidden lg:inline-flex">{roleText}</Badge>
      <Avatar name={user.name} className="size-8 text-xs" />
      <SignOutButton />
    </div>
  );
}
