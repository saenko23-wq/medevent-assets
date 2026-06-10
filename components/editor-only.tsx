import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function EditorOnly({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const canEdit = ["admin", "manager", "operations"].includes(session?.user.role ?? "");

  if (!canEdit) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
        Вашій ролі доступний режим перегляду. Для створення або зміни записів потрібна роль admin, manager або operations.
      </div>
    );
  }

  return <>{children}</>;
}
