"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/lib/auth/auth-context";
import { configureAmplify } from "@/lib/auth/amplify-config";
import styles from "./AuthPage.module.css";

configureAmplify();

// ── Validation schemas ────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

const signupSchema = z
  .object({
    email: z.string().email("Enter a valid email address."),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .regex(/[A-Z]/, "Must contain at least one uppercase letter.")
      .regex(/[a-z]/, "Must contain at least one lowercase letter.")
      .regex(/[0-9]/, "Must contain at least one number."),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

type LoginForm = z.infer<typeof loginSchema>;
type SignupForm = z.infer<typeof signupSchema>;

type Tab = "login" | "signup";
type Step = "form" | "verify";

// ── Auth page component ───────────────────────────────────────────────────────

export function AuthPage() {
  const router = useRouter();
  const { login, register, confirm, resendCode, isAuthenticated } = useAuth();

  const [tab, setTab] = useState<Tab>("login");
  const [step, setStep] = useState<Step>("form");
  const [pendingEmail, setPendingEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bannerError, setBannerError] = useState("");
  const [bannerSuccess, setBannerSuccess] = useState("");

  // Redirect if already logged in.
  useEffect(() => {
    if (isAuthenticated) router.replace("/dashboard");
  }, [isAuthenticated, router]);

  // ── Login form ──────────────────────────────────────────────────────────────

  const {
    register: regLogin,
    handleSubmit: handleLoginSubmit,
    formState: { errors: loginErrors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onLogin = useCallback(
    async (data: LoginForm) => {
      setBannerError("");
      setIsSubmitting(true);
      try {
        const result = await login(data.email, data.password);
        if (result.isSignedIn) {
          router.push("/dashboard");
        } else if (result.nextStep?.signInStep === "CONFIRM_SIGN_UP") {
          setPendingEmail(data.email);
          setStep("verify");
          setBannerSuccess("Your email needs to be verified. Check your inbox.");
        }
      } catch (err) {
        setBannerError(
          err instanceof Error ? err.message : "Login failed. Please try again."
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [login, router]
  );

  // ── Signup form ─────────────────────────────────────────────────────────────

  const {
    register: regSignup,
    handleSubmit: handleSignupSubmit,
    formState: { errors: signupErrors },
  } = useForm<SignupForm>({ resolver: zodResolver(signupSchema) });

  const onSignup = useCallback(
    async (data: SignupForm) => {
      setBannerError("");
      setIsSubmitting(true);
      try {
        await register(data.email, data.password);
        setPendingEmail(data.email);
        setStep("verify");
        setBannerSuccess("");
      } catch (err) {
        setBannerError(
          err instanceof Error ? err.message : "Sign up failed. Please try again."
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [register]
  );

  // ── OTP / verify step ───────────────────────────────────────────────────────

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const digits = text.split("");
    setOtp([...digits, ...Array(6 - digits.length).fill("")]);
    otpRefs.current[Math.min(digits.length, 5)]?.focus();
  };

  const onConfirm = useCallback(async () => {
    const code = otp.join("");
    if (code.length !== 6) {
      setBannerError("Enter all 6 digits of your verification code.");
      return;
    }
    setBannerError("");
    setIsSubmitting(true);
    try {
      await confirm(pendingEmail, code);
      setBannerSuccess("Email verified! Signing you in…");
      // Auto-navigate to login to let user sign in with verified account.
      setTimeout(() => {
        setStep("form");
        setTab("login");
        setBannerSuccess("Email verified. Please sign in.");
      }, 1200);
    } catch (err) {
      setBannerError(
        err instanceof Error ? err.message : "Verification failed."
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [otp, pendingEmail, confirm]);

  const handleResendCode = useCallback(async () => {
    setBannerError("");
    setBannerSuccess("");
    try {
      await resendCode(pendingEmail);
      setBannerSuccess("A new code has been sent to your email.");
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : "Failed to resend code.");
    }
  }, [pendingEmail, resendCode]);

  // ── Tab switch ──────────────────────────────────────────────────────────────

  const switchTab = (next: Tab) => {
    setTab(next);
    setStep("form");
    setBannerError("");
    setBannerSuccess("");
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const isBusy = isSubmitting;

  return (
    <div className={styles.root}>
      <Link href="/" className={styles.backLink} aria-label="Back to landing page">
        ← KAVACHPAY
      </Link>

      <div className={styles.card} role="main">
        <span className={styles.cornerMark}>KP{"\n"}AUTH</span>

        {/* ── Header ── */}
        <div className={styles.header}>
          <span className={styles.wordmark}>KavachPay</span>
          <h1 className={styles.title}>
            {step === "verify"
              ? "Verify your email"
              : tab === "login"
              ? "Sign in to continue"
              : "Create your account"}
          </h1>
          <p className={styles.subtitle}>
            {step === "verify"
              ? "SEC-AUTH // EMAIL CONFIRM"
              : tab === "login"
              ? "SEC-AUTH // SIGN-IN"
              : "SEC-AUTH // REGISTER"}
          </p>
        </div>

        <div className={styles.rule} aria-hidden="true" />

        {/* ── Tabs (hidden during verify step) ── */}
        {step === "form" && (
          <div className={styles.tabs} role="tablist">
            <button
              role="tab"
              id="tab-login"
              aria-selected={tab === "login"}
              aria-controls="panel-login"
              className={`${styles.tab} ${tab === "login" ? styles.tabActive : ""}`}
              onClick={() => switchTab("login")}
            >
              LOGIN
            </button>
            <button
              role="tab"
              id="tab-signup"
              aria-selected={tab === "signup"}
              aria-controls="panel-signup"
              className={`${styles.tab} ${tab === "signup" ? styles.tabActive : ""}`}
              onClick={() => switchTab("signup")}
            >
              SIGN UP
            </button>
          </div>
        )}

        {/* ── Banners ── */}
        {bannerError && (
          <div className={styles.errorBanner} role="alert">
            {bannerError}
          </div>
        )}
        {bannerSuccess && !bannerError && (
          <div className={styles.successBanner} role="status">
            {bannerSuccess}
          </div>
        )}

        {/* ── Verify / OTP step ── */}
        {step === "verify" && (
          <div>
            <p className={styles.verifyInfo}>
              A 6-digit code was sent to{" "}
              <span className={styles.verifyEmail}>{pendingEmail}</span>.
              {"\n"}Enter it below. The code expires in 24 hours.
            </p>
            <div className={styles.form}>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Verification code</label>
                <div
                  className={styles.otpGroup}
                  onPaste={handleOtpPaste}
                  aria-label="6-digit verification code"
                >
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { otpRefs.current[i] = el; }}
                      id={`otp-${i}`}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      autoComplete="one-time-code"
                      aria-label={`Digit ${i + 1} of 6`}
                      className={`${styles.input} ${styles.otpInput}`}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      disabled={isBusy}
                    />
                  ))}
                </div>
              </div>

              <button
                id="btn-verify"
                type="button"
                className={styles.submit}
                onClick={onConfirm}
                disabled={isBusy}
              >
                {isBusy && <span className={styles.spinner} aria-hidden="true" />}
                VERIFY EMAIL
              </button>

              <div className={styles.footerLinks}>
                <button
                  type="button"
                  className={styles.footerLink}
                  onClick={handleResendCode}
                  disabled={isBusy}
                >
                  Resend code
                </button>
                <button
                  type="button"
                  className={styles.footerLink}
                  onClick={() => { setStep("form"); setBannerError(""); }}
                >
                  ← Back
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Login panel ── */}
        {step === "form" && tab === "login" && (
          <form
            id="panel-login"
            role="tabpanel"
            aria-labelledby="tab-login"
            className={styles.form}
            onSubmit={handleLoginSubmit(onLogin)}
            noValidate
          >
            <div className={styles.fieldGroup}>
              <label htmlFor="login-email" className={styles.label}>
                Email
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className={`${styles.input} ${loginErrors.email ? styles.inputError : ""}`}
                disabled={isBusy}
                {...regLogin("email")}
              />
              {loginErrors.email && (
                <span className={styles.fieldError}>{loginErrors.email.message}</span>
              )}
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="login-password" className={styles.label}>
                Password
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className={`${styles.input} ${loginErrors.password ? styles.inputError : ""}`}
                disabled={isBusy}
                {...regLogin("password")}
              />
              {loginErrors.password && (
                <span className={styles.fieldError}>{loginErrors.password.message}</span>
              )}
            </div>

            <button
              id="btn-login"
              type="submit"
              className={styles.submit}
              disabled={isBusy}
            >
              {isBusy && <span className={styles.spinner} aria-hidden="true" />}
              SIGN IN
            </button>

            <div className={styles.footerLinks}>
              <button
                type="button"
                className={styles.footerLink}
                onClick={() => switchTab("signup")}
              >
                Create account
              </button>
            </div>
          </form>
        )}

        {/* ── Signup panel ── */}
        {step === "form" && tab === "signup" && (
          <form
            id="panel-signup"
            role="tabpanel"
            aria-labelledby="tab-signup"
            className={styles.form}
            onSubmit={handleSignupSubmit(onSignup)}
            noValidate
          >
            <div className={styles.fieldGroup}>
              <label htmlFor="signup-email" className={styles.label}>
                Email
              </label>
              <input
                id="signup-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className={`${styles.input} ${signupErrors.email ? styles.inputError : ""}`}
                disabled={isBusy}
                {...regSignup("email")}
              />
              {signupErrors.email && (
                <span className={styles.fieldError}>{signupErrors.email.message}</span>
              )}
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="signup-password" className={styles.label}>
                Password
              </label>
              <input
                id="signup-password"
                type="password"
                autoComplete="new-password"
                placeholder="Min 8 chars · upper + lower + number"
                className={`${styles.input} ${signupErrors.password ? styles.inputError : ""}`}
                disabled={isBusy}
                {...regSignup("password")}
              />
              {signupErrors.password && (
                <span className={styles.fieldError}>{signupErrors.password.message}</span>
              )}
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="signup-confirm" className={styles.label}>
                Confirm password
              </label>
              <input
                id="signup-confirm"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                className={`${styles.input} ${signupErrors.confirmPassword ? styles.inputError : ""}`}
                disabled={isBusy}
                {...regSignup("confirmPassword")}
              />
              {signupErrors.confirmPassword && (
                <span className={styles.fieldError}>{signupErrors.confirmPassword.message}</span>
              )}
            </div>

            <button
              id="btn-signup"
              type="submit"
              className={styles.submit}
              disabled={isBusy}
            >
              {isBusy && <span className={styles.spinner} aria-hidden="true" />}
              CREATE ACCOUNT
            </button>

            <div className={styles.footerLinks}>
              <button
                type="button"
                className={styles.footerLink}
                onClick={() => switchTab("login")}
              >
                Already have an account?
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
