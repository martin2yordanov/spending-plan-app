import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App";
import { initNative } from "./native";
import AppLock from "./AppLock";
import ErrorBoundary from "./ErrorBoundary";
import "./index.css";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Inside the lock, so a crash in the app cannot take the gate down with it
// and expose the plan behind it.
const app = (
  <AppLock>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </AppLock>
);

const tree = PUBLISHABLE_KEY ? (
  <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
    {app}
  </ClerkProvider>
) : (
  app
);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>{tree}</React.StrictMode>,
);

// The splash is held open (launchAutoHide: false) until this runs, and it must
// not come down over an empty WebView. `render()` on a concurrent root only
// *schedules* the work, so calling this straight after it was a race. Two
// frames is the usual way to land after a real paint: the first callback runs
// before the upcoming frame, the second after it has been committed.
let nativeStarted = false;
const startNative = () => {
  if (nativeStarted) return;
  nativeStarted = true;
  initNative();
};
requestAnimationFrame(() => requestAnimationFrame(startNative));
// iOS can launch an app straight into the background, where animation frames
// do not run. Nothing is on screen to protect then, and a splash that never
// comes down would outlast the reason for holding it.
setTimeout(startNative, 2000);
