import { useCallback, useEffect, useState } from "react";
import { isNative, biometricAvailable, biometricUnlock, BIOMETRIC_LOCK_KEY } from "./native";

async function readFlag() {
  try {
    if (isNative) {
      const { Preferences } = await import("@capacitor/preferences");
      return (await Preferences.get({ key: BIOMETRIC_LOCK_KEY })).value === "1";
    }
    return localStorage.getItem(BIOMETRIC_LOCK_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Holds the app behind Face ID / Touch ID when the user has switched the lock
 * on. Renders children directly whenever the lock is off, unavailable, or we
 * are not on a device, so the web build is untouched.
 *
 * The gate defaults to *unlocked* while the stored preference is still being
 * read. Defaulting to locked would flash a lock screen at every single user,
 * including the overwhelming majority who never enable it.
 */
export default function AppLock({ children }) {
  const [checked, setChecked] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [unlocked, setUnlocked] = useState(true);
  const [failed, setFailed] = useState(false);

  const attempt = useCallback(async () => {
    setFailed(false);
    const ok = await biometricUnlock("Unlock Spending Plan");
    setUnlocked(ok);
    setFailed(!ok);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const on = (await readFlag()) && (await biometricAvailable());
      if (cancelled) return;
      setEnabled(on);
      setChecked(true);
      if (!on) return;
      setUnlocked(false);
      const ok = await biometricUnlock("Unlock Spending Plan");
      if (cancelled) return;
      setUnlocked(ok);
      setFailed(!ok);
    })();
    return () => { cancelled = true; };
  }, []);

  // Re-lock when the app is backgrounded, so handing the unlocked phone to
  // someone else does not hand over the finances with it.
  useEffect(() => {
    if (!isNative || !enabled) return;
    let remove;
    (async () => {
      const { App } = await import("@capacitor/app");
      const handle = await App.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) { setUnlocked(false); setFailed(false); }
      });
      remove = () => handle.remove();
    })();
    return () => { if (remove) remove(); };
  }, [enabled]);

  if (!checked || !enabled || unlocked) return children;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#D6C9B9",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", gap: 18, padding: 24, zIndex: 9999,
    }}>
      <img src="/money-bag.png" alt="" aria-hidden="true" style={{ height: 84, width: "auto" }} />
      <div style={{ fontSize: 17, fontWeight: 700, color: "#3B2E20" }}>Spending Plan</div>
      <div style={{ fontSize: 13, color: "#6B5A45", textAlign: "center", maxWidth: 260 }}>
        {failed ? "Unlock failed. Try again." : "Unlocking…"}
      </div>
      <button
        onClick={attempt}
        style={{
          padding: "11px 22px", borderRadius: 12, border: "none", cursor: "pointer",
          background: "#3B2E20", color: "#fff", fontSize: 14, fontWeight: 600,
        }}
      >
        Unlock
      </button>
    </div>
  );
}
