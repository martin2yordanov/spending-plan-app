import { Component } from "react";
import { storedLang } from "./i18n";

// Its own string table, deliberately. This screen is up because something
// threw, and reaching into the main dictionary to render it means trusting the
// code that may well be what threw. Five strings is a cheap independence.
const COPY = {
  en: {
    title: "Something went wrong",
    body: "Your plan is saved on this device and nothing has been lost. Restarting usually clears it.",
    restart: "Restart",
    details: "Technical details",
  },
  bg: {
    title: "Нещо се обърка",
    body: "Планът ти е запазен на това устройство и нищо не е загубено. Рестартирането обикновено оправя нещата.",
    restart: "Рестартирай",
    details: "Технически детайли",
  },
  es: {
    title: "Algo ha ido mal",
    body: "Tu plan está guardado en este dispositivo y no se ha perdido nada. Reiniciar suele resolverlo.",
    restart: "Reiniciar",
    details: "Detalles técnicos",
  },
};

/**
 * Last line of defence for a render-time exception.
 *
 * Without one, React unmounts the whole tree and the user is left looking at a
 * white rectangle. In a browser that is at least a page they can reload; in a
 * WebView there is no reload button, no address bar and no console — the only
 * way out is to force-quit the app, and nothing tells them that. This has
 * already happened once here, from a component reading a variable that was
 * never passed to it.
 *
 * The plan itself is safe either way: it is cached on the device and stamped,
 * so a restart picks it back up. This says so, because the first thing anyone
 * assumes when a budgeting app goes blank is that their figures are gone.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // No reporting service is wired up, so this at least reaches the Safari
    // Web Inspector when the app is attached to a Mac for debugging.
    console.error("[ErrorBoundary]", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    const copy = COPY[storedLang()] ?? COPY.en;

    return (
      <div
        role="alert"
        style={{
          minHeight: "100vh",
          background: "#F2F2F7",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          padding: "24px calc(24px + env(safe-area-inset-left)) calc(24px + env(safe-area-inset-bottom))",
          textAlign: "center",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', sans-serif",
          color: "#1C1C1E",
        }}
      >
        <div style={{ fontSize: "2.5rem", lineHeight: 1 }}>😵‍💫</div>
        <div style={{ fontSize: "1.125rem", fontWeight: 700 }}>{copy.title}</div>
        <div style={{ fontSize: "0.84375rem", color: "#6C6C70", lineHeight: 1.55, maxWidth: 300 }}>
          {copy.body}
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 4,
            padding: "11px 22px",
            borderRadius: 12,
            border: "none",
            cursor: "pointer",
            background: "#007AFF",
            color: "#fff",
            fontSize: "0.875rem",
            fontWeight: 600,
          }}
        >
          {copy.restart}
        </button>
        {/* Collapsed, because the message means nothing to most people, but
            present so a bug report can carry something useful. */}
        <details style={{ marginTop: 8, maxWidth: 320, width: "100%" }}>
          <summary style={{ fontSize: "0.75rem", color: "#8E8E93", cursor: "pointer" }}>
            {copy.details}
          </summary>
          <pre
            style={{
              marginTop: 8,
              fontSize: "0.6875rem",
              color: "#6C6C70",
              textAlign: "left",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              background: "#fff",
              borderRadius: 10,
              padding: 12,
              maxHeight: 180,
              overflow: "auto",
            }}
          >
            {String(this.state.error?.stack || this.state.error)}
          </pre>
        </details>
      </div>
    );
  }
}
