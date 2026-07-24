"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Boxes, Loader2, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OtpInput } from "@/components/shared/otp-input";

type Step = "identify" | "verify";

const PIN_LENGTH = 4;

/**
 * Sign-in screen — username + 4-digit password flow.
 *
 * Step 1 collects the user name; step 2 collects a 4-digit password.
 * Auth is not wired to a backend yet: any 4-digit password is accepted
 * and, on success, the user continues to workspace selection. Replace
 * the handlers with real calls once the auth provider exists — the
 * two-step UX stays the same.
 */
export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("identify");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function goToPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!username.trim()) {
      setError("Enter your user name to continue.");
      return;
    }

    setStep("verify");
    setPin("");
  }

  function signIn(code: string) {
    setError(null);
    if (code.length !== PIN_LENGTH) {
      setError(`Enter your ${PIN_LENGTH}-digit password.`);
      return;
    }
    setSubmitting(true);
    // Placeholder for the real credential check; hands off to the
    // workspace picker on success.
    router.push("/workspaces");
  }

  function changeUsername() {
    setStep("identify");
    setPin("");
    setError(null);
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-8">
      {/* Compact brand mark — the full brand rail is hidden on small screens. */}
      <div className="flex items-center gap-2.5 lg:hidden">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Boxes className="h-5 w-5" />
        </div>
        <span className="text-lg font-semibold tracking-tight">ProjectOps</span>
      </div>

      {step === "identify" ? (
        <>
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Sign in to your workspace
            </h1>
            <p className="text-sm text-muted-foreground">
              Enter your user name to continue.
            </p>
          </div>

          <form onSubmit={goToPassword} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="username">User name</Label>
              <Input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                placeholder="prithivi"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                aria-invalid={Boolean(error) || undefined}
                autoFocus
              />
            </div>

            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <Button type="submit" className="w-full">
              Next
            </Button>
          </form>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <Lock className="h-5 w-5" />
            </div>
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                Enter your password
              </h1>
              <p className="text-sm text-muted-foreground">
                Enter the {PIN_LENGTH}-digit password for{" "}
                <span className="font-medium text-foreground">{username}</span>.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <OtpInput
              value={pin}
              onChange={setPin}
              onComplete={signIn}
              length={PIN_LENGTH}
              mask
              invalid={Boolean(error)}
              disabled={submitting}
              autoFocus
              aria-label="Password digit"
            />

            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <Button
              type="button"
              className="w-full"
              disabled={submitting || pin.length !== PIN_LENGTH}
              onClick={() => signIn(pin)}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </Button>

            <button
              type="button"
              onClick={changeUsername}
              className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              Change user name
            </button>
          </div>
        </>
      )}

      <p className="text-center text-xs text-muted-foreground/80">
        By continuing you agree to our{" "}
        <a href="#" className="underline-offset-4 hover:underline">
          Terms
        </a>{" "}
        and{" "}
        <a href="#" className="underline-offset-4 hover:underline">
          Privacy Policy
        </a>
        .
      </p>
    </div>
  );
}
