"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Boxes,
  Check,
  CircleCheck,
  Loader2,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { OtpInput } from "@/components/shared/otp-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, ApiError } from "@/lib/api/client";
import {
  CREATE_USER_SLUG,
  useRegister,
  useRequestOtp,
  useVerifyOtp,
} from "@/lib/api/hooks/use-auth";
import { safeAuthDestination } from "@/lib/auth/redirect";
import type { Workspace } from "@/lib/api/types";

type Step = "identify" | "register" | "verify";

const OTP_LENGTH = 6;

function messageFor(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

/**
 * Sign-in screen wired to the real API.
 *
 * 1. `identify` — enter a username → POST /auth/otp/request.
 * 2. `register` — collect profile → POST /auth/register (sends an OTP).
 * 3. `verify`   — enter the 6-digit OTP → POST /auth/otp/verify.
 *
 * OTP verification includes an animated enterprise-style success state
 * before navigating to the workspace selection screen.
 */
export const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
};

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const destination = searchParams.get("next");
  const redirectAfterLogin = safeAuthDestination(destination);

  const [step, setStep] = useState<Step>("identify");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [isVerified, setIsVerified] = useState(false);

  const requestOtp = useRequestOtp();
  const register = useRegister();
  const verifyOtp = useVerifyOtp();

  /**
   * Navigate to workspace after the verification success animation.
   */
  useEffect(() => {
    if (!isVerified) return;

    const timer = window.setTimeout(async () => {
      let destination = redirectAfterLogin;

      if (redirectAfterLogin === "/workspaces") {
        try {
          const workspaces = await apiFetch<Workspace[]>("/workspaces/me");
          const defaultWorkspace = workspaces.find(
            (workspace) => workspace.isDefault,
          );
          if (defaultWorkspace) {
            destination = `/${defaultWorkspace.slug}/projects`;
          }
        } catch {
          // The workspaces page will display the appropriate load state.
        }
      }

      window.location.href = destination;
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [isVerified, redirectAfterLogin, router]);

  function submitUsername(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError(null);

    if (!email.trim()) {
      setError("Enter your Email to continue.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Enter your valid email.");
      return;
    }

    requestOtp.mutate(
      {
        email: email.trim()?.toLocaleLowerCase(),
      },
      {
        onSuccess: (data) => {
          setOtp("");
          setIsVerified(false);
          verifyOtp.reset();
          setStep(data?.slug === CREATE_USER_SLUG ? "register" : "verify");
        },
        onError: (err) =>
          setError(messageFor(err, "Couldn't request a code. Try again.")),
      },
    );
  }

  function submitRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError(null);

    if (!firstName.trim()) {
      setError("Enter your first name.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Enter your valid email.");
      return;
    }
    register.mutate(
      {
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        email: email.trim().toLowerCase(),
      },
      {
        onSuccess: () => {
          setOtp("");
          setIsVerified(false);
          verifyOtp.reset();
          setStep("verify");
        },
        onError: (err) =>
          setError(messageFor(err, "Couldn't create your account.")),
      },
    );
  }

  function verify(code: string) {
    setError(null);

    if (code.length !== OTP_LENGTH) {
      setError(`Enter the ${OTP_LENGTH}-digit code.`);
      return;
    }

    verifyOtp.mutate(
      {
        email: email.trim(),
        otp: code,
      },
      {
        onSuccess: () => {
          /**
           * `verifyOtp.isSuccess` immediately drives the OtpInput's own
           * wheel-spin → glowing-check animation (see `otpStatus` below).
           * Delay flipping `isVerified` so that flourish gets to play
           * before this view is replaced by the full success screen.
           */
          window.setTimeout(() => setIsVerified(true), 750);
        },
        onError: (err) =>
          setError(messageFor(err, "That code didn't work. Try again.")),
      },
    );
  }

  const isOtpError = Boolean(error);
  const otpStatus = verifyOtp.isPending
    ? "loading"
    : verifyOtp.isSuccess
      ? "success"
      : isOtpError
        ? "error"
        : "idle";

  return (
    <div className="flex w-full max-w-sm flex-col gap-8">
      {/* Mobile Brand */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="flex items-center gap-2.5 lg:hidden"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Boxes className="h-5 w-5" />
        </div>

        <span className="text-lg font-semibold tracking-tight">ProjectOps</span>
      </motion.div>

      <AnimatePresence mode="wait">
        {/* ================================================================ */}
        {/* IDENTIFY STEP                                                    */}
        {/* ================================================================ */}
        {step === "identify" && (
          <motion.div
            key="identify"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="flex flex-col gap-8"
          >
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                Sign in to your workspace
              </h1>

              <p className="text-sm text-muted-foreground">
                Enter your user name to continue.
              </p>
            </div>

            <form
              onSubmit={submitUsername}
              noValidate
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="username">Email</Label>

                <Input
                  id="username"
                  name="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  aria-invalid={Boolean(error) || undefined}
                  autoFocus
                />
              </div>

              <AnimatePresence>
                {error ? (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    role="alert"
                    className="text-sm text-destructive"
                  >
                    {error}
                  </motion.p>
                ) : null}
              </AnimatePresence>

              <Button
                type="submit"
                className="w-full"
                disabled={requestOtp.isPending}
              >
                {requestOtp.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking…
                  </>
                ) : (
                  "Next"
                )}
              </Button>
            </form>
          </motion.div>
        )}

        {/* ================================================================ */}
        {/* REGISTER STEP                                                     */}
        {/* ================================================================ */}
        {step === "register" && (
          <motion.div
            key="register"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="flex flex-col gap-8"
          >
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                Create your account
              </h1>

              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{email}</span> is
                new here. Add a few details to get started.
              </p>
            </div>

            <form
              onSubmit={submitRegister}
              noValidate
              className="flex flex-col gap-4"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="firstName">First name</Label>

                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    autoFocus
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="lastName">Last name</Label>

                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>

                <Input
                  id="email"
                  type="email"
                  placeholder="jane@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>

              <AnimatePresence>
                {error ? (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    role="alert"
                    className="text-sm text-destructive"
                  >
                    {error}
                  </motion.p>
                ) : null}
              </AnimatePresence>

              <Button
                type="submit"
                className="w-full"
                disabled={register.isPending}
              >
                {register.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  "Create account & send code"
                )}
              </Button>

              <button
                type="button"
                onClick={() => {
                  setStep("identify");
                  setError(null);
                }}
                className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                <ArrowLeft className="h-4 w-4" />
                Change user name
              </button>
            </form>
          </motion.div>
        )}

        {/* ================================================================ */}
        {/* OTP VERIFY STEP                                                   */}
        {/* ================================================================ */}
        {step === "verify" && (
          <motion.div
            key="verify"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="flex flex-col gap-8"
          >
            <AnimatePresence mode="wait">
              {!isVerified ? (
                /* ======================================================== */
                /* OTP ENTRY VIEW                                           */
                /* ======================================================== */
                <motion.div
                  key="otp-entry"
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.25 }}
                  className="flex flex-col gap-8"
                >
                  {/* OTP Header */}
                  <div className="flex flex-col gap-4">
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 260,
                        damping: 20,
                      }}
                      className="relative flex h-12 w-12 items-center justify-center rounded-xl border bg-secondary text-secondary-foreground shadow-sm"
                    >
                      {/* Animated security glow */}
                      <motion.div
                        animate={{
                          scale: [1, 1.15, 1],
                          opacity: [0.15, 0.3, 0.15],
                        }}
                        transition={{
                          duration: 2.2,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                        className="absolute inset-0 rounded-xl bg-primary/20"
                      />

                      <ShieldCheck className="relative z-10 h-6 w-6" />
                    </motion.div>

                    <div className="flex flex-col gap-2">
                      <h1 className="text-2xl font-semibold tracking-tight">
                        Verify your identity
                      </h1>

                      <p className="text-sm leading-6 text-muted-foreground">
                        Enter the {OTP_LENGTH}-digit verification code sent for{" "}
                        <span className="font-semibold text-foreground">
                          {email}
                        </span>
                        .
                      </p>
                    </div>
                  </div>

                  {/* OTP Card */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15, duration: 0.4 }}
                    className="relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm"
                  >
                    {/* Decorative animated background */}
                    <motion.div
                      animate={{
                        x: ["-10%", "110%"],
                      }}
                      transition={{
                        duration: 3.5,
                        repeat: Infinity,
                        repeatDelay: 3,
                        ease: "easeInOut",
                      }}
                      className="pointer-events-none absolute -top-20 h-40 w-24 rotate-12 bg-gradient-to-b from-transparent via-primary/5 to-transparent blur-xl"
                    />

                    <div className="relative flex flex-col gap-5">
                      {/* Security indicator */}
                      <div className="flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground">
                        <Lock className="h-3.5 w-3.5" />

                        <span>Secure verification · {OTP_LENGTH} digits</span>
                      </div>

                      {/* OTP Input — shake-on-error and the success
                          wheel-spin/glow flourish are handled internally
                          by OtpInput via the `status` prop. */}
                      <div className="flex justify-center">
                        <OtpInput
                          value={otp}
                          onChange={(value) => {
                            setOtp(value);

                            if (error) {
                              setError(null);
                            }
                          }}
                          onComplete={verify}
                          length={OTP_LENGTH}
                          invalid={Boolean(error)}
                          disabled={verifyOtp.isPending}
                          status={otpStatus}
                          autoFocus
                          aria-label="Verification code digit"
                        />
                      </div>

                      {/* OTP progress indicator */}
                      {otpStatus !== "success" && (
                        <div className="flex items-center justify-center gap-1.5">
                          {Array.from({ length: OTP_LENGTH }).map(
                            (_, index) => {
                              const isFilled = index < otp.length;

                              return (
                                <motion.div
                                  key={index}
                                  initial={{ scale: 0.6, opacity: 0 }}
                                  animate={{
                                    scale: isFilled ? 1 : 0.8,
                                    opacity: isFilled ? 1 : 0.35,
                                  }}
                                  transition={{
                                    type: "spring",
                                    stiffness: 400,
                                    damping: 20,
                                    delay: index * 0.03,
                                  }}
                                  className={`h-1.5 rounded-full transition-all duration-300 ${
                                    isFilled
                                      ? "w-5 bg-primary"
                                      : "w-1.5 bg-muted-foreground/30"
                                  }`}
                                />
                              );
                            },
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>

                  {/* Error */}
                  <AnimatePresence>
                    {error ? (
                      <motion.div
                        initial={{ opacity: 0, height: 0, y: -5 }}
                        animate={{ opacity: 1, height: "auto", y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -5 }}
                        className="overflow-hidden"
                      >
                        <div
                          role="alert"
                          className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-center text-sm text-destructive"
                        >
                          {error}
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>

                  {otpStatus !== "success" && (
                    <>
                      {/* Verify Button */}
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 }}
                      >
                        <Button
                          type="button"
                          className="h-11 w-full shadow-sm transition-all duration-300"
                          disabled={
                            verifyOtp.isPending || otp.length !== OTP_LENGTH
                          }
                          onClick={() => verify(otp)}
                        >
                          {verifyOtp.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Verifying securely…</span>
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="h-4 w-4" />
                              <span>Verify and continue</span>
                            </>
                          )}
                        </Button>
                      </motion.div>

                      {/* Change username */}
                      <div className="flex justify-between">
                        <button
                          type="button"
                          onClick={() => {
                            setStep("identify");
                            setOtp("");
                            setError(null);
                            setIsVerified(false);
                            verifyOtp.reset();
                          }}
                          className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                        >
                          <ArrowLeft className="h-4 w-4" />
                          Change Email
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            submitUsername(
                              e as unknown as React.FormEvent<HTMLFormElement>,
                            );
                          }}
                          className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                        >
                          Resend OTP
                        </button>
                      </div>
                    </>
                  )}
                </motion.div>
              ) : (
                /* ======================================================== */
                /* VERIFIED SUCCESS VIEW                                    */
                /* ======================================================== */
                <motion.div
                  key="verified"
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    duration: 0.5,
                    ease: "easeOut",
                  }}
                  className="relative flex min-h-[390px] flex-col items-center justify-center overflow-hidden rounded-2xl border bg-card p-8 text-center shadow-sm"
                >
                  {/* Ambient success glow */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 0.35, scale: 1 }}
                    transition={{ duration: 0.8 }}
                    className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl"
                  />

                  {/* Expanding success ring */}
                  <motion.div
                    initial={{
                      opacity: 0,
                      scale: 0.4,
                    }}
                    animate={{
                      opacity: [0, 0.35, 0],
                      scale: [0.5, 1.8, 2.2],
                    }}
                    transition={{
                      duration: 1.5,
                      ease: "easeOut",
                    }}
                    className="pointer-events-none absolute left-1/2 top-[38%] h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/40"
                  />

                  {/* Success Icon */}
                  <motion.div
                    initial={{
                      opacity: 0,
                      scale: 0.4,
                      rotate: -15,
                    }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                      rotate: 0,
                    }}
                    transition={{
                      delay: 0.15,
                      type: "spring",
                      stiffness: 240,
                      damping: 16,
                    }}
                    className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
                  >
                    {/* Outer pulse */}
                    <motion.div
                      initial={{ scale: 1, opacity: 0.4 }}
                      animate={{
                        scale: [1, 1.25, 1],
                        opacity: [0.4, 0, 0.4],
                      }}
                      transition={{
                        duration: 1.8,
                        repeat: Infinity,
                        ease: "easeOut",
                      }}
                      className="absolute inset-0 rounded-full bg-primary"
                    />

                    <motion.div
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{
                        delay: 0.35,
                        duration: 0.45,
                        ease: "easeOut",
                      }}
                      className="relative z-10 flex h-full w-full items-center justify-center"
                    >
                      <Check className="h-10 w-10 stroke-[2.5]" />
                    </motion.div>
                  </motion.div>

                  {/* Success Text */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: 0.45,
                      duration: 0.4,
                    }}
                    className="relative z-10 flex flex-col items-center gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <CircleCheck className="h-5 w-5 text-primary" />

                      <h1 className="text-xl font-semibold tracking-tight">
                        Verified Successfully
                      </h1>
                    </div>

                    <p className="max-w-xs text-sm leading-6 text-muted-foreground">
                      Your identity has been securely verified. Preparing your
                      workspace…
                    </p>
                  </motion.div>

                  {/* Loading transition */}
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{
                      opacity: 1,
                      width: "80%",
                    }}
                    transition={{
                      delay: 0.7,
                      duration: 0.4,
                    }}
                    className="relative z-10 mt-7 h-1 overflow-hidden rounded-full bg-muted"
                  >
                    <motion.div
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{
                        duration: 1.1,
                        ease: "easeInOut",
                      }}
                      className="h-full rounded-full bg-primary"
                    />
                  </motion.div>

                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.9 }}
                    className="relative z-10 mt-3 text-xs text-muted-foreground"
                  >
                    Redirecting you securely
                  </motion.p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Terms & Privacy */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-center text-xs text-muted-foreground/80"
      >
        By continuing you agree to our{" "}
        <a href="#" className="underline-offset-4 hover:underline">
          Terms
        </a>{" "}
        and{" "}
        <a href="#" className="underline-offset-4 hover:underline">
          Privacy Policy
        </a>
        .
      </motion.p>
    </div>
  );
}
