import React, { useState, useEffect } from "react";
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogOut,
  CheckCircle2,
  ShieldAlert,
  Calendar,
  Save,
  UserPlus,
  LogIn,
  KeyRound
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { auth, db, googleProvider, handleFirestoreError, OperationType } from "../firebase";
import {
  signOut,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  updateEmail,
  verifyBeforeUpdateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  sendPasswordResetEmail,
  User as FirebaseUser
} from "@firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp } from "@firebase/firestore";
import { Language, Translations } from "../translations";

export interface OwnPlusAccount {
  id: string;
  username: string;
  email: string;
  createdAt: string;
  authProvider?: "password" | "google";
  sessionToken?: string;
}

const SESSION_STORAGE_KEY = "ownplus_verified_session_v2";
const LOCKOUT_STORAGE_KEY = "ownplus_auth_lockout_v2";

// Clean up legacy local-only storage keys so unauthenticated local accounts cannot masquerade as cloud sessions
try {
  localStorage.removeItem("ownplus_logged_in_user_v1");
  localStorage.removeItem("ownplus_accounts_vault_v2");
} catch {}

// Validation constants synchronized verbatim with firebase-blueprint.json and firestore.rules
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 24;
const DISPLAY_NAME_MAX_LENGTH = 30;
const EMAIL_MIN_LENGTH = 5;
const EMAIL_MAX_LENGTH = 120;
const USERNAME_REGEX = /^[a-zA-Z0-9_.\u0600-\u06FF]{3,24}$/;
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,12}$/;

function saveCachedSession(account: OwnPlusAccount): void {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(account));
  } catch {}
}

export function getVerifiedSession(): OwnPlusAccount | null {
  try {
    const rawSession = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!rawSession) return null;
    const session = JSON.parse(rawSession) as OwnPlusAccount;
    if (!session || !session.id || !session.username || !session.email) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function clearVerifiedSession(): void {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem("ownplus_logged_in_user_v1");
    localStorage.removeItem("ownplus_accounts_vault_v2");
  } catch {}
}

function toIsoDateString(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  if (typeof value === "number") {
    return new Date(value).toISOString();
  }
  return new Date().toISOString();
}

function clampDisplayName(raw: string, uid: string): string {
  const cleaned = raw.trim().slice(0, DISPLAY_NAME_MAX_LENGTH);
  if (cleaned.length >= USERNAME_MIN_LENGTH) {
    return cleaned;
  }
  return `user_${uid.slice(0, 6)}`.slice(0, DISPLAY_NAME_MAX_LENGTH);
}

function resolveAuthProvider(
  user: FirebaseUser,
  forced?: "password" | "google"
): "password" | "google" {
  if (forced) return forced;
  if (user.providerData.some((p) => p.providerId === "google.com")) {
    return "google";
  }
  return "password";
}

let pendingSignupUsername: string | null = null;
const activeSyncLocks = new Map<string, Promise<OwnPlusAccount>>();

export async function syncUserProfileToFirestore(
  user: FirebaseUser,
  preferredUsername?: string,
  forcedProvider?: "password" | "google"
): Promise<OwnPlusAccount> {
  const existingLock = activeSyncLocks.get(user.uid);
  if (existingLock) {
    try {
      await existingLock;
    } catch {
      // Proceed to fresh attempt if prior sync failed
    }
  }

  const resolvedPreferred = preferredUsername || pendingSignupUsername || undefined;

  const runSync = async (): Promise<OwnPlusAccount> => {
    const userPath = `users/${user.uid}`;
    const userRef = doc(db, "users", user.uid);
    const resolvedProvider = resolveAuthProvider(user, forcedProvider);

    const rawEmail = (user.email || `${user.uid.slice(0, 8)}@gmail.com`)
      .trim()
      .toLowerCase()
      .slice(0, EMAIL_MAX_LENGTH);
    const cleanEmail =
      EMAIL_REGEX.test(rawEmail) && rawEmail.length >= EMAIL_MIN_LENGTH
        ? rawEmail
        : `${user.uid.slice(0, 8)}@ownplus.app`;

    const fallbackNameRaw =
      resolvedPreferred ||
      user.displayName ||
      cleanEmail.split("@")[0] ||
      `user_${user.uid.slice(0, 5)}`;
    const fallbackDisplayName = clampDisplayName(fallbackNameRaw, user.uid);

    let snap;
    try {
      snap = await getDoc(userRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, userPath);
      throw err;
    }

    if (!snap.exists()) {
      const createPayload: Record<string, unknown> = {
        id: user.uid,
        email: cleanEmail,
        displayName: fallbackDisplayName,
        role: "customer",
        authProvider: resolvedProvider,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      if (user.photoURL && user.photoURL.length <= 500) {
        createPayload.photoUrl = user.photoURL;
      }

      try {
        await setDoc(userRef, createPayload);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, userPath);
      }

      const account: OwnPlusAccount = {
        id: user.uid,
        username: fallbackDisplayName,
        email: cleanEmail,
        createdAt: new Date().toISOString(),
        authProvider: resolvedProvider
      };
      saveCachedSession(account);
      return account;
    }

    const data = snap.data() || {};
    const existingProvider =
      data.authProvider === "google" || data.authProvider === "password"
        ? data.authProvider
        : resolvedProvider;
    const finalDisplayName = resolvedPreferred
      ? clampDisplayName(resolvedPreferred, user.uid)
      : clampDisplayName(String(data.displayName || fallbackDisplayName), user.uid);
    const finalEmail = cleanEmail;

    const needsLegacyBackfill = !data.createdAt || !data.role || !data.authProvider;
    const needsProfileSync =
      (resolvedPreferred && finalDisplayName !== data.displayName) ||
      finalEmail !== data.email;

    if (needsLegacyBackfill) {
      const backfillPayload: Record<string, unknown> = {
        email: finalEmail,
        displayName: finalDisplayName,
        role: typeof data.role === "string" ? data.role : "customer",
        authProvider: existingProvider,
        updatedAt: serverTimestamp()
      };
      if (!data.createdAt) {
        backfillPayload.createdAt = serverTimestamp();
      }
      if (user.photoURL && user.photoURL.length <= 500) {
        backfillPayload.photoUrl = user.photoURL;
      }

      try {
        await updateDoc(userRef, backfillPayload);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, userPath);
      }
    } else if (needsProfileSync) {
      try {
        await updateDoc(userRef, {
          email: finalEmail,
          displayName: finalDisplayName,
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, userPath);
      }
    }

    const account: OwnPlusAccount = {
      id: user.uid,
      username: finalDisplayName,
      email: finalEmail,
      createdAt: toIsoDateString(data.createdAt),
      authProvider: existingProvider
    };
    saveCachedSession(account);
    return account;
  };

  const promise = runSync().finally(() => {
    if (activeSyncLocks.get(user.uid) === promise) {
      activeSyncLocks.delete(user.uid);
    }
  });
  activeSyncLocks.set(user.uid, promise);
  return promise;
}

function getFirebaseErrorCode(err: unknown): string {
  if (
    err &&
    typeof err === "object" &&
    "code" in err &&
    typeof (err as { code: unknown }).code === "string"
  ) {
    return (err as { code: string }).code;
  }
  if (err instanceof Error) {
    const match = err.message.match(/\(?(auth\/[a-zA-Z0-9_-]+)\)?/);
    if (match) return match[1];
  }
  return "";
}

function mapFirebaseAuthError(
  err: unknown,
  context: "login" | "signup" | "google" | "profile" | "reset"
): string {
  const code = getFirebaseErrorCode(err);

  switch (code) {
    case "auth/email-already-in-use":
      return "ئەم ئیمەیڵە پێشتر هەژماری پێ دروستکراوە، تکایە بڕۆ بەشی Log In";
    case "auth/invalid-email":
      return "تکایە ئیمەیڵێکی دروست و فەرمی بنووسە (وەک name@gmail.com)";
    case "auth/weak-password":
      return "وشەی نهێنی لاوازە، تکایە لانیکەم ٨ پیت و ژمارەی تێدابێت";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return context === "profile"
        ? "وشەی نهێنی ئێستا هەڵەیە! گۆڕانکارییەکان پاشەکەوت نەکران."
        : "ئیمەیڵ یان وشەی نهێنی هەڵەیە! ئەگەر هەژمارت نییە لە بەشی Sign Up دروستی بکە.";
    case "auth/user-disabled":
      return "ئەم هەژمارە ڕاگیراوە";
    case "auth/too-many-requests":
      return "هەوڵی زۆر دراوە، تکایە کەمێکی تر دووبارە هەوڵبدەرەوە";
    case "auth/operation-not-allowed":
      return "چوونەژوورەوە بە ئیمەیڵ و وشەی نهێنی لە Firebase Console چالاک نەکراوە";
    case "auth/network-request-failed":
      return "پەیوەندی ئینتەرنێت لاوازە یان پچڕاوە، تکایە دووبارە هەوڵبدەرەوە";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "پەنجەرەی چوونەژوورەوەی گووگڵ داخرا، تکایە دووبارە هەوڵبدەرەوە";
    case "auth/popup-blocked":
      return "وێبگەڕەکە پەنجەرەی گووگڵی بلۆک کردووە، تکایە ڕێگە بە Pop-up بدە";
    case "auth/unauthorized-domain":
      return "ئەم دۆمەینە لە Firebase Console ڕێگەپێدراو نییە";
    case "auth/requires-recent-login":
      return "بۆ ئەم گۆڕانکارییە تکایە جارێکی تر بچۆرە ژوورەوە";
    default:
      if (err instanceof Error && err.message.includes("operationType")) {
        return "کێشەیەک لە پەیوەندیکردن بە داتابەیسی Firebase ڕوویدا، تکایە دووبارە هەوڵبدەرەوە";
      }
      if (context === "google") {
        return "چوونەژوورەوە بە گووگڵ سەرنەکەوت، تکایە دووبارە هەوڵبدەرەوە";
      }
      if (context === "reset") {
        return "ناردنی بەستەر سەرنەکەوت، تکایە دووبارە هەوڵبدەرەوە";
      }
      return "هەڵەیەک ڕوویدا، تکایە زانیارییەکان بپشکنە و دووبارە هەوڵبدەرەوە";
  }
}

function evaluatePasswordStrength(password: string): {
  score: number;
  labelKu: string;
  labelEn: string;
  isValid: boolean;
} {
  if (!password) {
    return { score: 0, labelKu: "", labelEn: "", isValid: false };
  }
  const hasMinLen = password.length >= 8;
  const hasLetter = /[a-zA-Z\u0600-\u06FF]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialOrUpper = /[A-Z!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);

  let score = 0;
  if (password.length >= 6) score++;
  if (hasMinLen && hasLetter) score++;
  if (hasNumber) score++;
  if (hasMinLen && hasLetter && hasNumber && (hasSpecialOrUpper || password.length >= 10)) score++;

  const isValid = hasMinLen && hasLetter && hasNumber;

  if (score <= 1) {
    return { score: 1, labelKu: "لاواز", labelEn: "Weak", isValid };
  }
  if (score === 2) {
    return { score: 2, labelKu: "مامناوەند", labelEn: "Fair", isValid };
  }
  if (score === 3) {
    return { score: 3, labelKu: "باش", labelEn: "Good", isValid };
  }
  return { score: 4, labelKu: "بەهێز", labelEn: "Strong", isValid };
}

function validateUsernameInput(username: string): string | null {
  const clean = username.trim();
  if (clean.length < USERNAME_MIN_LENGTH) {
    return "ناوی بەکارهێنەر دەبێت لانیکەم ٣ پیت بێت (Min 3 characters)";
  }
  if (clean.length > USERNAME_MAX_LENGTH) {
    return "ناوی بەکارهێنەر زۆر درێژە (Max 24 characters)";
  }
  if (!USERNAME_REGEX.test(clean)) {
    return "ناوی بەکارهێنەر تەنها پیت و ژمارە و (_) وەردەگرێت بەبێ بۆشایی";
  }
  if (/^[0-9_.]+$/.test(clean)) {
    return "ناوی بەکارهێنەر دەبێت پیتیشی تێدابێت نەک تەنها ژمارە";
  }
  return null;
}

function validateEmailInput(email: string): string | null {
  const clean = email.trim().toLowerCase();
  if (
    !clean ||
    clean.length < EMAIL_MIN_LENGTH ||
    clean.length > EMAIL_MAX_LENGTH ||
    !EMAIL_REGEX.test(clean)
  ) {
    return "تکایە ئیمەیڵێکی دروست و فەرمی بنووسە (وەک name@gmail.com)";
  }
  const parts = clean.split("@");
  if (parts[0].length < 2 || parts[1].length < 4) {
    return "فۆرماتی ئیمەیڵەکە نادروستە";
  }
  return null;
}

interface OwnPlusLoginScreenProps {
  onSuccess: (account: OwnPlusAccount) => void;
  initialMode?: "login" | "signup";
  onCancelSwitch?: () => void;
}

export function OwnPlusLoginScreen({
  onSuccess,
  initialMode = "login",
  onCancelSwitch
}: OwnPlusLoginScreenProps) {
  const [isSignUp, setIsSignUp] = useState(initialMode === "signup");
  const [loginEmail, setLoginEmail] = useState("");
  const [signUpUsername, setSignUpUsername] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);


  // Brute-force protection state
  const [failedAttempts, setFailedAttempts] = useState<number>(() => {
    try {
      const data = JSON.parse(localStorage.getItem(LOCKOUT_STORAGE_KEY) || "{}");
      return Number(data.attempts) || 0;
    } catch {
      return 0;
    }
  });
  const [lockoutUntil, setLockoutUntil] = useState<number>(() => {
    try {
      const data = JSON.parse(localStorage.getItem(LOCKOUT_STORAGE_KEY) || "{}");
      return Number(data.lockoutUntil) || 0;
    } catch {
      return 0;
    }
  });
  const [remainingLockSeconds, setRemainingLockSeconds] = useState<number>(0);

  useEffect(() => {
    setIsSignUp(initialMode === "signup");
  }, [initialMode]);

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      if (lockoutUntil > now) {
        setRemainingLockSeconds(Math.ceil((lockoutUntil - now) / 1000));
      } else {
        setRemainingLockSeconds(0);
      }
    };
    updateTimer();
    const interval = window.setInterval(updateTimer, 500);
    return () => window.clearInterval(interval);
  }, [lockoutUntil]);



  const recordFailedAttempt = () => {
    const nextAttempts = failedAttempts + 1;
    let nextLock = lockoutUntil;
    if (nextAttempts >= 5) {
      nextLock = Date.now() + 30 * 1000;
    }
    setFailedAttempts(nextAttempts);
    setLockoutUntil(nextLock);
    try {
      localStorage.setItem(
        LOCKOUT_STORAGE_KEY,
        JSON.stringify({ attempts: nextAttempts >= 5 ? 0 : nextAttempts, lockoutUntil: nextLock })
      );
    } catch {}
  };

  const resetFailedAttempts = () => {
    setFailedAttempts(0);
    setLockoutUntil(0);
    try {
      localStorage.removeItem(LOCKOUT_STORAGE_KEY);
    } catch {}
  };

  const passwordStrength = evaluatePasswordStrength(password);

  const handleGoogleSignIn = async () => {
    if (remainingLockSeconds > 0) return;
    setErrorMsg("");
    setInfoMsg("");
    setIsSubmitting(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const verifiedAccount = await syncUserProfileToFirestore(
        result.user,
        undefined,
        "google"
      );
      resetFailedAttempts();
      setIsSubmitting(false);
      onSuccess(verifiedAccount);
    } catch (err) {
      setIsSubmitting(false);
      setErrorMsg(mapFirebaseAuthError(err, "google"));
    }
  };

  const handleForgotPassword = async () => {
    const cleanEmail = loginEmail.trim().toLowerCase();
    const emailErr = validateEmailInput(cleanEmail);
    if (emailErr) {
      setInfoMsg("");
      setErrorMsg("سەرەتا ئیمەیڵە تۆمارکراوەکەت لە خانەی Email بنووسە بۆ نوێکردنەوەی وشەی نهێنی");
      return;
    }
    setErrorMsg("");
    setInfoMsg("");
    setIsSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      setIsSubmitting(false);
      setInfoMsg(
        "بەستەری نوێکردنەوەی وشەی نهێنی نێردرا بۆ ئیمەیڵەکەت (تکایە سەیری Inbox یان Spam بکە)"
      );
    } catch (err) {
      setIsSubmitting(false);
      setErrorMsg(mapFirebaseAuthError(err, "reset"));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (remainingLockSeconds > 0) {
      setErrorMsg(
        `بەهۆی هەوڵی هەڵەی زۆرەوە سیستەمەکە قفڵ بووە بۆ ماوەی ${remainingLockSeconds} چرکە`
      );
      return;
    }

    setErrorMsg("");
    setInfoMsg("");

    if (isSignUp) {
      const cleanUser = signUpUsername.trim();
      const cleanEmail = signUpEmail.trim().toLowerCase();
      const rawPass = password;
      const rawConfirm = confirmPassword;

      const userErr = validateUsernameInput(cleanUser);
      if (userErr) {
        setErrorMsg(userErr);
        return;
      }

      const emailErr = validateEmailInput(cleanEmail);
      if (emailErr) {
        setErrorMsg(emailErr);
        return;
      }

      if (!passwordStrength.isValid) {
        setErrorMsg(
          "وشەی نهێنی دەبێت لانیکەم ٨ پیت بێت و پیت و ژمارەی تێدابێت (Min 8 chars, letters & numbers)"
        );
        return;
      }

      if (rawPass !== rawConfirm) {
        setErrorMsg("وشەی نهێنی و دووبارەکردنەوەی وشەی نهێنی وەک یەک نین!");
        return;
      }

      setIsSubmitting(true);
      pendingSignupUsername = cleanUser;
      try {
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, rawPass);
        await updateProfile(cred.user, { displayName: cleanUser }).catch(() => {});
        await cred.user.getIdToken(true).catch(() => {});
        const verifiedAccount = await syncUserProfileToFirestore(
          cred.user,
          cleanUser,
          "password"
        );

        resetFailedAttempts();
        setIsSubmitting(false);
        onSuccess(verifiedAccount);
      } catch (err) {
        setIsSubmitting(false);
        setErrorMsg(mapFirebaseAuthError(err, "signup"));
      } finally {
        pendingSignupUsername = null;
      }
      return;
    }

    // FIREBASE EMAIL & PASSWORD LOG IN
    const cleanEmail = loginEmail.trim().toLowerCase();
    const rawPass = password;

    const emailErr = validateEmailInput(cleanEmail);
    if (emailErr) {
      setErrorMsg("تکایە ئیمەیڵە تۆمارکراوەکەت بە دروستی بنووسە (وەک name@gmail.com)");
      return;
    }

    if (!rawPass) {
      setErrorMsg("تکایە وشەی نهێنی بنووسە");
      return;
    }

    setIsSubmitting(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, rawPass);
      const current = auth.currentUser || cred.user;

      await current.getIdToken(true).catch(() => {});
      const verifiedAccount = await syncUserProfileToFirestore(
        current,
        current.displayName || undefined,
        "password"
      );

      resetFailedAttempts();
      setIsSubmitting(false);
      onSuccess(verifiedAccount);
    } catch (err) {
      setIsSubmitting(false);
      const code = getFirebaseErrorCode(err);
      if (
        code === "auth/invalid-credential" ||
        code === "auth/wrong-password" ||
        code === "auth/user-not-found"
      ) {
        recordFailedAttempt();
      }
      setErrorMsg(mapFirebaseAuthError(err, "login"));
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9998] bg-white flex flex-col items-center justify-center px-6 select-none overflow-y-auto py-8"
      dir="ltr"
    >
      <div className="w-full max-w-[330px] flex flex-col items-center my-auto">
        {/* Animated own+ Logo */}
        <motion.div
          initial={{ y: 70, scale: 1.04 }}
          animate={{ y: 0, scale: 1 }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          className="mb-6 flex flex-col items-center justify-center"
        >
          <img
            src="/assets/aistudio/key-logo-header.png"
            alt="own+"
            onError={(e) => {
              const target = e.currentTarget;
              if (!target.src.includes("key_logo_cutout_4e6dd2d9.png")) {
                target.src = "/assets/aistudio/key_logo_cutout_4e6dd2d9.png";
              }
            }}
            className="w-[116px] h-auto object-contain select-none pointer-events-none drop-shadow-[0_2px_6px_rgba(15,23,42,0.18)]"
          />
        </motion.div>

          <>
            {/* Prominent Log In / Sign Up Mode Switcher Pill */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, delay: 0.03, ease: [0.32, 0.72, 0, 1] }}
              className="w-full p-1 mb-4 rounded-full bg-slate-100 border border-[#d6dbe3] grid grid-cols-2 gap-1"
            >
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(false);
                  setErrorMsg("");
                  setInfoMsg("");
                }}
                className={`h-[40px] rounded-full text-[13px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  !isSignUp
                    ? "bg-[#1c69e3] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Log In (چوونەژوورەوە)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsSignUp(true);
                  setErrorMsg("");
                  setInfoMsg("");
                }}
                className={`h-[40px] rounded-full text-[13px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  isSignUp
                    ? "bg-[#1c69e3] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Sign Up (تۆمارکردن)</span>
              </button>
            </motion.div>

            {/* Login / Sign Up Form */}
            <motion.form
              onSubmit={handleSubmit}
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.05, ease: [0.32, 0.72, 0, 1] }}
              className="w-full flex flex-col gap-3"
            >
              <motion.div
                key={isSignUp ? "signup-fields" : "login-fields"}
                initial={{ opacity: 0.65, x: isSignUp ? 28 : -28 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.19, ease: [0.32, 0.72, 0, 1] }}
                className="w-full flex flex-col gap-3"
              >
                {isSignUp ? (
                  <>
                    {/* Sign Up Username */}
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={signUpUsername}
                        onChange={(e) => {
                          setSignUpUsername(e.target.value);
                          if (errorMsg) setErrorMsg("");
                        }}
                        placeholder="Username (ناوی بەکارهێنەر)"
                        autoComplete="username"
                        maxLength={USERNAME_MAX_LENGTH}
                        className="w-full h-[48px] pl-11 pr-5 rounded-full bg-white border border-[#d6dbe3] text-[14px] text-slate-800 placeholder:text-[#9ca3af] font-normal focus:outline-none focus:border-[#1c69e3] focus:ring-2 focus:ring-[#1c69e3]/15 transition-all"
                      />
                    </div>

                    {/* Sign Up Email */}
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="email"
                        value={signUpEmail}
                        onChange={(e) => {
                          setSignUpEmail(e.target.value);
                          if (errorMsg) setErrorMsg("");
                        }}
                        placeholder="Email (name@example.com)"
                        autoComplete="email"
                        maxLength={EMAIL_MAX_LENGTH}
                        className="w-full h-[48px] pl-11 pr-5 rounded-full bg-white border border-[#d6dbe3] text-[14px] text-slate-800 placeholder:text-[#9ca3af] font-normal focus:outline-none focus:border-[#1c69e3] focus:ring-2 focus:ring-[#1c69e3]/15 transition-all"
                      />
                    </div>
                  </>
                ) : (
                  /* Log In Email */
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => {
                        setLoginEmail(e.target.value);
                        if (errorMsg) setErrorMsg("");
                        if (infoMsg) setInfoMsg("");
                      }}
                      placeholder="Email (name@example.com)"
                      autoComplete="email"
                      maxLength={EMAIL_MAX_LENGTH}
                      className="w-full h-[48px] pl-11 pr-5 rounded-full bg-white border border-[#d6dbe3] text-[14px] text-slate-800 placeholder:text-[#9ca3af] font-normal focus:outline-none focus:border-[#1c69e3] focus:ring-2 focus:ring-[#1c69e3]/15 transition-all"
                    />
                  </div>
                )}
              </motion.div>

              {/* Password Field with Eye Toggle */}
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMsg) setErrorMsg("");
                  }}
                  placeholder={isSignUp ? "Strong Password (Min 8 chars)" : "Password"}
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  className="w-full h-[48px] pl-11 pr-11 rounded-full bg-white border border-[#d6dbe3] text-[14px] text-slate-800 placeholder:text-[#9ca3af] font-normal focus:outline-none focus:border-[#1c69e3] focus:ring-2 focus:ring-[#1c69e3]/15 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Forgot Password Button in Log In mode */}
              {!isSignUp && (
                <div className="flex justify-end px-2 -mt-1">
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={isSubmitting || remainingLockSeconds > 0}
                    className="text-[11.5px] font-semibold text-[#1c69e3] hover:underline cursor-pointer disabled:opacity-50"
                  >
                    وشەی نهێنیت لەبیرچووە؟ (Forgot password?)
                  </button>
                </div>
              )}

              {/* Password Strength Meter & Confirm Password in Sign Up mode */}
              {isSignUp && (
                <>
                  {password.length > 0 && (
                    <div className="px-3 py-0.5 flex flex-col gap-1.5" dir="rtl">
                      <div className="w-full h-[3px] rounded-full bg-slate-100 overflow-hidden" dir="ltr">
                        <div
                          className={`h-full rounded-full transition-all duration-200 ${
                            passwordStrength.score <= 1
                              ? "w-1/4 bg-rose-500"
                              : passwordStrength.score === 2
                              ? "w-2/4 bg-amber-500"
                              : passwordStrength.score === 3
                              ? "w-3/4 bg-[#1c69e3]"
                              : "w-full bg-emerald-600"
                          }`}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] leading-none">
                        <span className="text-slate-500 font-medium">
                          هێزی وشەی نهێنی:{" "}
                          <span
                            className={`font-semibold ${
                              passwordStrength.score <= 1
                                ? "text-rose-600"
                                : passwordStrength.score === 2
                                ? "text-amber-600"
                                : passwordStrength.score === 3
                                ? "text-[#1c69e3]"
                                : "text-emerald-600"
                            }`}
                          >
                            {passwordStrength.labelKu}
                          </span>
                        </span>
                        {!passwordStrength.isValid && (
                          <span className="text-slate-400 font-normal">
                            لانیکەم ٨ پیت و ژمارە
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (errorMsg) setErrorMsg("");
                      }}
                      placeholder="Confirm Password (دووبارەکردنەوەی وشەی نهێنی)"
                      autoComplete="new-password"
                      className="w-full h-[48px] pl-11 pr-5 rounded-full bg-white border border-[#d6dbe3] text-[14px] text-slate-800 placeholder:text-[#9ca3af] font-normal focus:outline-none focus:border-[#1c69e3] focus:ring-2 focus:ring-[#1c69e3]/15 transition-all"
                    />
                  </div>
                </>
              )}

              {/* Success / Info Alert */}
              {infoMsg && (
                <div
                  className="rounded-2xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 flex items-center gap-2 text-emerald-700 text-[12px] font-semibold"
                  dir="rtl"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{infoMsg}</span>
                </div>
              )}

              {/* Error / Lockout Alert */}
              {(errorMsg || remainingLockSeconds > 0) && (
                <div
                  className="rounded-2xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 flex items-center gap-2 text-rose-600 text-[12px] font-semibold"
                  dir="rtl"
                >
                  <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>
                    {remainingLockSeconds > 0
                      ? `چوونەژوورەوە بە شێوەی کاتی قفڵ بووە (${remainingLockSeconds}s)`
                      : errorMsg}
                  </span>
                </div>
              )}

              {/* Primary Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || remainingLockSeconds > 0}
                className="w-full h-[48px] mt-1 rounded-full bg-[#1c69e3] hover:bg-[#1659c7] disabled:opacity-50 active:scale-[0.99] text-white text-[15px] font-semibold tracking-tight shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  "..."
                ) : isSignUp ? (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Sign Up (دروستکردنی هەژمار)</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Log In (چوونەژوورەوە)</span>
                  </>
                )}
              </button>

              {/* Verified Google OAuth Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting || remainingLockSeconds > 0}
                className="w-full h-[46px] rounded-full bg-slate-50 hover:bg-slate-100 active:scale-[0.99] border border-[#d6dbe3] text-slate-700 text-[13px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-2.5"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.3 0 6.08-1.09 8.1-2.96l-3.88-3.05c-1.08.72-2.45 1.16-4.22 1.16-3.24 0-5.98-2.19-6.96-5.14H1.04v3.14C3.05 21.14 7.21 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.04 14.01c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.29H1.04C.38 7.61 0 9.11 0 11.72s.38 4.11 1.04 5.43l4-3.14z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.8 0 3.41.62 4.68 1.84l3.51-3.51C18.07 1.19 15.3 0 12 0 7.21 0 3.05 2.86 1.04 6.29l4 3.14c.98-2.95 3.72-5.14 6.96-5.14z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              {onCancelSwitch && (
                <button
                  type="button"
                  onClick={onCancelSwitch}
                  className="mt-1 text-center text-[12px] text-slate-500 hover:text-slate-800 underline font-semibold cursor-pointer"
                >
                  گەڕانەوە بۆ پڕۆفایلەکەم (Back to Profile)
                </button>
              )}
            </motion.form>
          </>
      </div>
    </div>
  );
}

interface ProfileViewProps {
  lang: Language;
  t: Translations;
  account?: OwnPlusAccount | null;
  onLoginSuccess?: (account: OwnPlusAccount) => void;
  onLogout?: () => void;
}

export default function ProfileView({
  lang,
  account,
  onLoginSuccess,
  onLogout
}: ProfileViewProps) {
  const [localAccount, setLocalAccount] = useState<OwnPlusAccount | null>(() => {
    if (account !== undefined) return account;
    return getVerifiedSession();
  });

  const [authModalMode, setAuthModalMode] = useState<"login" | "signup" | null>(null);

  const activeAccount = account !== undefined ? account : localAccount;

  const [username, setUsername] = useState(activeAccount?.username || "");
  const [email, setEmail] = useState(activeAccount?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileInfo, setProfileInfo] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    if (activeAccount) {
      setUsername(activeAccount.username);
      setEmail(activeAccount.email);
      setCurrentPassword("");
      setNewPassword("");
      setProfileError("");
    }
  }, [activeAccount]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccount) return;

    setProfileError("");
    setProfileInfo("");
    const cleanUser = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    const userErr = validateUsernameInput(cleanUser);
    if (userErr) {
      setProfileError(userErr);
      return;
    }

    const emailErr = validateEmailInput(cleanEmail);
    if (emailErr) {
      setProfileError(emailErr);
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      setProfileError("دانیشتنەکەت بەسەرچووە، تکایە دووبارە بچۆرە ژوورەوە");
      return;
    }

    const isPasswordUser = activeAccount.authProvider !== "google";

    if (isPasswordUser && !currentPassword) {
      setProfileError(
        lang === "ku"
          ? "بۆ پاراستنی هەژمارەکەت، تکایە وشەی نهێنی ئێستات بنووسە بۆ پاشەکەوتکردن"
          : "Please enter your current password to verify changes"
      );
      return;
    }

    if (isPasswordUser && showChangePassword && newPassword.length > 0) {
      const strength = evaluatePasswordStrength(newPassword);
      if (!strength.isValid) {
        setProfileError("وشەی نهێنی نوێ دەبێت لانیکەم ٨ پیت بێت و پیت و ژمارەی تێدابێت");
        return;
      }
    }

    setIsSaving(true);
    try {
      if (isPasswordUser) {
        const credential = EmailAuthProvider.credential(
          currentUser.email || activeAccount.email,
          currentPassword
        );
        await reauthenticateWithCredential(currentUser, credential);

        if (showChangePassword && newPassword.length > 0) {
          await updatePassword(currentUser, newPassword);
        }
      }

      let syncedEmail = (currentUser.email || activeAccount.email).toLowerCase();
      if (isPasswordUser && cleanEmail !== syncedEmail) {
        try {
          await updateEmail(currentUser, cleanEmail);
          syncedEmail = cleanEmail;
        } catch (emailUpdateErr) {
          const code = getFirebaseErrorCode(emailUpdateErr);
          if (code === "auth/operation-not-allowed") {
            await verifyBeforeUpdateEmail(currentUser, cleanEmail);
            setProfileInfo(
              lang === "ku"
                ? `بەستەری دڵنیابوونەوە نێردرا بۆ ${cleanEmail} — دوای کلیککردنی بەستەرەکە ئیمەیڵەکەت دەگۆڕدرێت.`
                : `Verification link sent to ${cleanEmail}. Confirm it to complete email update.`
            );
          } else {
            throw emailUpdateErr;
          }
        }
      }

      await updateProfile(currentUser, { displayName: cleanUser }).catch(() => {});

      const userPath = `users/${currentUser.uid}`;
      try {
        await updateDoc(doc(db, "users", currentUser.uid), {
          email: syncedEmail,
          displayName: cleanUser,
          updatedAt: serverTimestamp()
        });
      } catch (fsErr) {
        handleFirestoreError(fsErr, OperationType.UPDATE, userPath);
      }

      const updatedSession: OwnPlusAccount = {
        id: currentUser.uid,
        username: cleanUser,
        email: syncedEmail,
        createdAt: activeAccount.createdAt,
        authProvider: activeAccount.authProvider
      };

      saveCachedSession(updatedSession);
      setLocalAccount(updatedSession);
      if (onLoginSuccess) onLoginSuccess(updatedSession);
      setCurrentPassword("");
      setNewPassword("");
      setShowChangePassword(false);
      setIsSaving(false);
      setSavedNotice(true);
      window.setTimeout(() => setSavedNotice(false), 2400);
    } catch (err) {
      setIsSaving(false);
      setProfileError(mapFirebaseAuthError(err, "profile"));
    }
  };

  const handleSignOut = async () => {
    clearVerifiedSession();
    try {
      await signOut(auth).catch(() => {});
    } catch {}
    setLocalAccount(null);
    if (onLogout) onLogout();
  };

  if (!activeAccount || authModalMode !== null) {
    return (
      <OwnPlusLoginScreen
        initialMode={authModalMode || "login"}
        onCancelSwitch={activeAccount ? () => setAuthModalMode(null) : undefined}
        onSuccess={(acc) => {
          setAuthModalMode(null);
          setLocalAccount(acc);
          if (onLoginSuccess) onLoginSuccess(acc);
        }}
      />
    );
  }

  const formattedDate = (() => {
    try {
      return new Date(activeAccount.createdAt).toLocaleDateString(
        lang === "ku" ? "ku-IQ" : "en-US",
        { year: "numeric", month: "short", day: "numeric" }
      );
    } catch {
      return "2025";
    }
  })();

  return (
    <div className="w-full flex flex-col items-center pb-28 select-none">
      {/* Sleek Login-Style Card Container */}
      <div className="w-full max-w-[370px] rounded-[36px] bg-white dark:bg-slate-900 border border-[#e2e8f0] dark:border-white/10 shadow-xl px-6 py-8 flex flex-col items-center">
        {/* Animated own+ Hero Logo matching Login Screen */}
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          className="mb-4 flex flex-col items-center"
        >
          <img
            src="/assets/aistudio/key-logo-header.png"
            alt="own+"
            onError={(e) => {
              const target = e.currentTarget;
              if (!target.src.includes("key_logo_cutout_4e6dd2d9.png")) {
                target.src = "/assets/aistudio/key_logo_cutout_4e6dd2d9.png";
              }
            }}
            className="w-[110px] h-auto object-contain select-none pointer-events-none drop-shadow-[0_2px_6px_rgba(15,23,42,0.18)] dark:drop-shadow-[0_0_12px_rgba(192,132,252,0.28)]"
          />
        </motion.div>

        {/* Direct Log In / Sign Up Switcher inside Profile View */}
        <div
          className="w-full max-w-[315px] p-1 mb-4 rounded-full bg-slate-100 dark:bg-slate-800 border border-[#d6dbe3] dark:border-slate-700 grid grid-cols-2 gap-1"
          dir="ltr"
        >
          <button
            type="button"
            onClick={() => setAuthModalMode("login")}
            className="h-[38px] rounded-full text-[12px] font-bold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 hover:text-[#1c69e3] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5 text-[#1c69e3]" />
            <span>Log In (گۆڕینی هەژمار)</span>
          </button>

          <button
            type="button"
            onClick={() => setAuthModalMode("signup")}
            className="h-[38px] rounded-full text-[12px] font-bold bg-[#1c69e3]/10 text-[#1c69e3] hover:bg-[#1c69e3] hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Sign Up (هەژماری نوێ)</span>
          </button>
        </div>

        {/* Login-Style Pill Form & Account Details */}
        <motion.form
          onSubmit={handleSaveProfile}
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          className="w-full max-w-[315px] flex flex-col gap-3"
        >
          {/* Username Pill Field */}
          <div className="relative" dir="ltr">
            <div className="w-8 h-8 rounded-full bg-[#1c69e3]/10 text-[#1c69e3] flex items-center justify-center absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
              <User className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (profileError) setProfileError("");
              }}
              maxLength={USERNAME_MAX_LENGTH}
              placeholder="Username (Min 3 chars)"
              className="w-full h-[46px] pl-12 pr-5 rounded-full bg-white dark:bg-slate-800 border border-[#d6dbe3] dark:border-slate-700 text-[13.5px] text-slate-800 dark:text-slate-100 placeholder:text-[#9ca3af] font-semibold focus:outline-none focus:border-[#1c69e3] focus:ring-2 focus:ring-[#1c69e3]/15 transition-all"
            />
          </div>

          {/* Email Pill Field */}
          <div className="relative" dir="ltr">
            <div className="w-8 h-8 rounded-full bg-[#1c69e3]/10 text-[#1c69e3] flex items-center justify-center absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
              <Mail className="w-4 h-4" />
            </div>
            <input
              type="email"
              value={email}
              disabled={activeAccount.authProvider === "google"}
              onChange={(e) => {
                setEmail(e.target.value);
                if (profileError) setProfileError("");
              }}
              maxLength={EMAIL_MAX_LENGTH}
              placeholder="Official Email"
              className="w-full h-[46px] pl-12 pr-5 rounded-full bg-white dark:bg-slate-800 border border-[#d6dbe3] dark:border-slate-700 text-[13.5px] text-slate-800 dark:text-slate-100 placeholder:text-[#9ca3af] font-normal focus:outline-none focus:border-[#1c69e3] focus:ring-2 focus:ring-[#1c69e3]/15 transition-all disabled:opacity-70"
            />
          </div>

          {/* Current Password Verification (Required to save changes on password accounts) */}
          {activeAccount.authProvider !== "google" && (
            <div className="relative" dir="ltr">
              <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  if (profileError) setProfileError("");
                }}
                placeholder={
                  lang === "ku"
                    ? "Current Password (وشەی نهێنی ئێستا)"
                    : "Current Password (to verify)"
                }
                className="w-full h-[46px] pl-12 pr-5 rounded-full bg-white dark:bg-slate-800 border border-[#d6dbe3] dark:border-slate-700 text-[13px] text-slate-800 dark:text-slate-100 placeholder:text-[#9ca3af] font-normal focus:outline-none focus:border-[#1c69e3] focus:ring-2 focus:ring-[#1c69e3]/15 transition-all"
              />
            </div>
          )}

          {/* Optional Change Password Toggle & Input */}
          {activeAccount.authProvider !== "google" && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowChangePassword((prev) => !prev)}
                className="text-[11.5px] font-bold text-[#1c69e3] hover:underline flex items-center justify-center gap-1 cursor-pointer py-0.5"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>
                  {showChangePassword
                    ? lang === "ku"
                      ? "داخستنی گۆڕینی وشەی نهێنی"
                      : "Cancel Password Change"
                    : lang === "ku"
                    ? "گۆڕینی وشەی نهێنی (Change Password)"
                    : "Change Password"}
                </span>
              </button>

              <AnimatePresence>
                {showChangePassword && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
                    className="overflow-hidden"
                    dir="ltr"
                  >
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          if (profileError) setProfileError("");
                        }}
                        placeholder="New Strong Password (8+ chars)"
                        className="w-full h-[46px] pl-12 pr-5 rounded-full bg-white dark:bg-slate-800 border border-[#d6dbe3] dark:border-slate-700 text-[13px] text-slate-800 dark:text-slate-100 placeholder:text-[#9ca3af] font-normal focus:outline-none focus:border-[#1c69e3] focus:ring-2 focus:ring-[#1c69e3]/15 transition-all"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Membership Date Pill */}
          <div className="w-full h-[44px] px-4 rounded-full bg-slate-50 dark:bg-slate-800/70 border border-[#d6dbe3]/80 dark:border-slate-700/80 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-1.5 font-bold">
              <Calendar className="w-3.5 h-3.5 text-[#1c69e3]" />
              {lang === "ku" ? "بەرواری بەشداربوون:" : "Joined:"}
            </span>
            <span className="font-semibold text-slate-800 dark:text-slate-100" dir="ltr">
              {formattedDate}
            </span>
          </div>

          {/* Info Banner */}
          {profileInfo && (
            <div className="rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 px-3.5 py-2 flex items-center gap-2 text-blue-700 dark:text-blue-300 text-[11.5px] font-bold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{profileInfo}</span>
            </div>
          )}

          {/* Validation Error Banner */}
          {profileError && (
            <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 px-3.5 py-2 flex items-center gap-2 text-rose-600 dark:text-rose-300 text-[11.5px] font-bold">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{profileError}</span>
            </div>
          )}

          {/* Primary #1c69e3 Pill Button */}
          <button
            type="submit"
            disabled={isSaving}
            className="w-full h-[46px] mt-0.5 rounded-full bg-[#1c69e3] hover:bg-[#1659c7] disabled:opacity-50 active:scale-[0.99] text-white text-[13.5px] font-semibold tracking-tight shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <span>...</span>
            ) : savedNotice ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {lang === "ku" ? "بە سەرکەوتوویی پاشەکەوت کرا" : "Verified & Saved"}
                </span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>
                  {lang === "ku" ? "پاشەکەوتکردنی زانیارییەکان" : "Save Verified Profile"}
                </span>
              </>
            )}
          </button>

          {/* Secondary Pill Button for Log Out */}
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full h-[44px] rounded-full bg-rose-500/10 hover:bg-rose-500/15 active:scale-[0.99] text-rose-600 dark:text-rose-400 border border-rose-500/25 text-[12.5px] font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span>
              {lang === "ku" ? "چوونەدەرەوە لە هەژمار (Log Out)" : "Log Out"}
            </span>
          </button>
        </motion.form>
      </div>
    </div>
  );
}
