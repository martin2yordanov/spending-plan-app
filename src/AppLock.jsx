import { useCallback, useEffect, useRef, useState } from "react";
import { storedLang } from "./i18n";
import {
  isNative,
  biometricAvailable,
  biometricUnlock,
  biometricLockHint,
  readBiometricLock,
} from "./native";

// Kept here rather than pulled from the main dictionary: this screen is up
// before the app has loaded anything, and it is four strings.
const COPY = {
  en: { title: "Spending Plan", unlocking: "Unlocking…", failed: "Unlock failed. Try again.", unlock: "Unlock", reason: "Unlock Spending Plan" },
  bg: { title: "Spending Plan", unlocking: "Отключване…", failed: "Отключването не успя. Опитай пак.", unlock: "Отключи", reason: "Отключи Spending Plan" },
  es: { title: "Spending Plan", unlocking: "Desbloqueando…", failed: "No se pudo desbloquear. Inténtalo de nuevo.", unlock: "Desbloquear", reason: "Desbloquea Spending Plan" },
};

/**
 * Holds the app behind Face ID / Touch ID when the user has switched the lock
 * on. Renders children directly whenever the lock is off, unavailable, or we
 * are not on a device, so the web build is untouched.
 *
 * The initial state comes from the synchronous hint rather than from the
 * authoritative (async) read. Waiting for that read meant one of two bad
 * outcomes: default to unlocked and the finances are on screen, and in the
 * app-switcher snapshot, for the frames it takes; default to locked and every
 * user who never enabled the lock — nearly all of them — gets a lock screen
 * flashed at them on every launch. The hint gets both cases right, and the
 * real read corrects it a moment later if it is ever wrong.
 */
export default function AppLock({ children }) {
  const [enabled, setEnabled] = useState(biometricLockHint);
  const [unlocked, setUnlocked] = useState(() => !biometricLockHint());
  const [failed, setFailed] = useState(false);
  const busyRef = useRef(false);
  const copy = COPY[storedLang()] ?? COPY.en;

  const attempt = useCallback(async () => {
    // A second prompt raised while the first is still up is rejected by iOS,
    // and the rejection reads as a failed unlock.
    if (busyRef.current) return;
    busyRef.current = true;
    setFailed(false);
    try {
      const ok = await biometricUnlock(copy.reason);
      setUnlocked(ok);
      setFailed(!ok);
    } finally {
      busyRef.current = false;
    }
  }, [copy.reason]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const on = (await readBiometricLock()) && (await biometricAvailable());
      if (cancelled) return;
      setEnabled(on);
      if (!on) {
        // The hint was stale (lock turned off elsewhere, or the hardware is
        // gone) — let the app through rather than stranding the user.
        setUnlocked(true);
        return;
      }
      setUnlocked(false);
      await attempt();
    })();
    return () => { cancelled = true; };
  }, [attempt]);

  // Re-lock when the app is backgrounded, so handing the unlocked phone to
  // someone else does not hand over the finances with it — and prompt again
  // on the way back, rather than making the owner tap Unlock first.
  useEffect(() => {
    if (!isNative || !enabled) return;
    let remove;
    let cancelled = false;
    (async () => {
      const { App } = await import("@capacitor/app");
      const handle = await App.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) { setUnlocked(false); setFailed(false); return; }
        setUnlocked((currentlyUnlocked) => {
          if (!currentlyUnlocked) attempt();
          return currentlyUnlocked;
        });
      });
      if (cancelled) handle.remove();
      else remove = () => handle.remove();
    })();
    return () => { cancelled = true; if (remove) remove(); };
  }, [enabled, attempt]);

  if (!enabled || unlocked) return children;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#D6C9B9",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", gap: 18, padding: 24, zIndex: 9999,
    }}>
      <img src="/money-bag.png" alt="" aria-hidden="true" style={{ height: 84, width: "auto" }} />
      <div style={{ fontSize: 17, fontWeight: 700, color: "#3B2E20" }}>{copy.title}</div>
      <div style={{ fontSize: 13, color: "#6B5A45", textAlign: "center", maxWidth: 260 }}>
        {failed ? copy.failed : copy.unlocking}
      </div>
      <button
        onClick={attempt}
        style={{
          padding: "11px 22px", borderRadius: 12, border: "none", cursor: "pointer",
          background: "#3B2E20", color: "#fff", fontSize: 14, fontWeight: 600,
        }}
      >
        {copy.unlock}
      </button>
    </div>
  );
}
