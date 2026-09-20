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

// After the first paint, so hiding the splash never reveals a blank WebView.
initNative();
