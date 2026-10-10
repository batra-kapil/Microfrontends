import { useEffect, useState } from "react";
import "@salesforce/platform-sdk/ui-embedding";
import { createViewSDK } from "@salesforce/platform-sdk/view";
import "./App.css";

const SLA_HOURS = { High: 4, Medium: 8, Low: 24 };

function formatRemaining(ms) {
  if (ms <= 0) return "SLA breached";
  const total = Math.floor(ms / 1000);
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function SlaCard({ caseInfo, now, onEscalate, escalating }) {
  const hours = SLA_HOURS[caseInfo.priority] ?? 24;
  const deadline = new Date(caseInfo.createdDate).getTime() + hours * 3600 * 1000;

  return (
    <div className="card">
      <div className="row">
        <span>Case {caseInfo.caseNumber}</span>
        <span className="badge">{caseInfo.priority}</span>
      </div>
      <div className="timer">{formatRemaining(deadline - now)}</div>
      <p>Response target: {hours} hours</p>
      <button onClick={onEscalate} disabled={caseInfo.priority === "High" || escalating}>
        {escalating ? "Escalating..." : "Escalate to High priority"}
      </button>
    </div>
  );
}

function Standalone() {
  return (
    <div className="standalone">
      <header className="hero">
        <div className="brand">Agenticwave</div>
        <h1>SLA Tracker</h1>
        <p>
          A small React app that shows how long a support agent has left to respond to a
          case. It is built to run inside a Salesforce Case page.
        </p>
      </header>

      <section className="panel">
        <h2>Response targets</h2>
        <div className="targets">
          {Object.entries(SLA_HOURS).map(([priority, hours]) => (
            <div className="target" key={priority}>
              <span className="badge">{priority}</span>
              <strong>{hours} hours</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>How it connects</h2>
        <ol className="steps">
          <li>The Salesforce Case page sends the case number, priority and created date.</li>
          <li>The tracker counts down to the response target.</li>
          <li>Escalate asks the Case page to set the priority to High. The app never updates Salesforce itself.</li>
        </ol>
      </section>

      <div className="empty">
        <div className="row">
          <span>No case connected</span>
          <span className="badge">Priority</span>
        </div>
        <div className="timer">--:--:--</div>
        <p>Open a Salesforce Case page to see live case data.</p>
      </div>
    </div>
  );
}

export default function App() {
  // "connecting" until createViewSDK resolves, then "standalone" or "embedded".
  const [mode, setMode] = useState("connecting");
  const [viewSdk, setViewSdk] = useState(null);
  const [caseInfo, setCaseInfo] = useState(null);
  const [escalating, setEscalating] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let cancelled = false;
    let unsubscribe;
    // The wrapper passes the case as props. New props also mean the escalation finished.
    const applyProps = (props) => {
      if (props?.caseNumber) {
        setCaseInfo(props);
        setEscalating(false);
      }
    };

    async function connect() {
      const sdk = await createViewSDK();
      // StrictMode in dev unmounts once before createViewSDK resolves.
      if (cancelled) return;
      // Outside Salesforce, createViewSDK resolves to an empty object.
      if (!sdk.getUiState || !sdk.dispatchEvent) {
        setMode("standalone");
        return;
      }
      setViewSdk(sdk);
      setMode("embedded");
      // Props are already in the UI state when createViewSDK resolves. Later changes arrive through subscribe.
      const uiState = sdk.getUiState();
      applyProps(uiState.state.props);
      unsubscribe = uiState.subscribe((next) => applyProps(next.props));
    }
    connect();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // If the update fails, no new props arrive. Release the button after 10 seconds.
  useEffect(() => {
    if (!escalating) return;
    const timeout = setTimeout(() => setEscalating(false), 10000);
    return () => clearTimeout(timeout);
  }, [escalating]);

  if (mode === "connecting") {
    return <p className="note">Connecting...</p>;
  }
  if (mode === "standalone") {
    return <Standalone />;
  }
  if (!caseInfo) {
    return <p className="note">Waiting for case details...</p>;
  }

  const escalate = () => {
    // Saving takes a few seconds. Block a second click until the new priority arrives.
    setEscalating(true);
    viewSdk.dispatchEvent(
      new CustomEvent("escalatecase", { detail: { caseNumber: caseInfo.caseNumber } })
    );
  };

  return <SlaCard caseInfo={caseInfo} now={now} onEscalate={escalate} escalating={escalating} />;
}
