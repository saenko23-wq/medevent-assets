import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Activity } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { LoginForm } from "@/app/login/login-form";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-7 shadow-soft">
        <div className="mb-7 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-brand text-white">
            <Activity size={23} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-950">MedEvent CRM</h1>
            <p className="text-sm text-slate-500">Управління медичними освітніми заходами</p>
          </div>
        </div>
        <LoginForm />
        <div className="mt-5 rounded-md bg-slate-50 p-3 text-sm text-slate-600">
          Демо: admin@medevent.local / medevent2026
        </div>
      </section>
    </main>
  );
}
