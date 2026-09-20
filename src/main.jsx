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
requestAnimationFrame(() => requestAnimationFrame(() => { initNative(); }));
