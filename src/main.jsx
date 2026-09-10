import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App";
import { initNative } from "./native";
import AppLock from "./AppLock";
import "./index.css";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const app = (
  <AppLock>
    <App />
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
