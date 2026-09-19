"use client";

import { useState } from "react";
import { ArrowRight, Check, FlaskConical, Play, RotateCcw, ShieldAlert } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { evaluateScenario, scenarios, type ScenarioId, type ScenarioResponse } from "@/lib/attack-lab";
import styles from "./attack-labs.module.css";

type Run = { response?: ScenarioResponse; error?: string };

export default function AttackLabsPage() {
  const [selectedId, setSelectedId] = useState<ScenarioId>(scenarios[0].id);
  const [runs, setRuns] = useState<Partial<Record<ScenarioId, Run>>>({});
  const [runningId, setRunningId] = useState<ScenarioId | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const selected = scenarios.find((scenario) => scenario.id === selectedId)!;
  const selectedRun = runs[selectedId];
  const outcome = selectedRun?.response ? evaluateScenario(selectedId, selectedRun.response) : null;
  const completed = scenarios.filter((scenario) => runs[scenario.id]?.response).length;
  const enforced = scenarios.filter((scenario) => {
    const run = runs[scenario.id];
    return run?.response && evaluateScenario(scenario.id, run.response).passed;
  }).length;

  const runScenario = async (id: ScenarioId) => {
    setRunningId(id);
    setSelectedId(id);
    setRuns((current) => ({ ...current, [id]: undefined }));
    try {
      const response = await apiClient.runAttackScenario(id);
      setRuns((current) => ({ ...current, [id]: { response } }));
    } catch (error) {
      setRuns((current) => ({ ...current, [id]: { error: error instanceof Error ? error.message : "Scenario could not run." } }));
    } finally {
      setRunningId(null);
    }
  };

  const runAll = async () => {
    setRunningAll(true);
    for (const scenario of scenarios) {
      await runScenario(scenario.id);
    }
    setRunningAll(false);
  };

  const trace = selectedRun?.response?.result?.trace ?? selectedRun?.response?.trace ?? [];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.kicker}><FlaskConical size={16} aria-hidden="true" /> AUTHORIZED SYNTHETIC TESTS <span aria-hidden="true">/</span> SANDBOX</div>
          <h1>Attack Labs</h1>
          <p>Put a payment boundary under pressure, then inspect what the control plane actually returned.</p>
        </div>
        <button className={styles.runAll} type="button" onClick={runAll} disabled={runningId !== null || runningAll}>
          {runningAll ? <RotateCcw size={18} className={styles.spinner} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
          {runningAll ? "Running scenarios…" : "Run all scenarios"}
        </button>
      </header>

      <div className={styles.briefing} role="note">
        <ShieldAlert size={21} aria-hidden="true" />
        <p>These routes operate on isolated KavachPay scenario data. Results below come from the sandbox backend, not from live merchants, accounts, or payment attempts.</p>
      </div>

      <div className={styles.summary} aria-live="polite">
        <span><strong>{String(completed).padStart(2, "0")}</strong><small>of {scenarios.length} run</small></span>
        <span><strong>{String(enforced).padStart(2, "0")}</strong><small>expected outcomes verified</small></span>
        <span className={styles.summaryNote}>A check only passes when the returned fields match the expected invariant.</span>
      </div>

      <div className={styles.workspace}>
        <section className={styles.scenarioIndex} aria-labelledby="scenario-heading">
          <div className={styles.indexHeader}><h2 id="scenario-heading">Scenario index</h2><span>SELECT / RUN</span></div>
          <div className={styles.scenarioList}>
            {scenarios.map((scenario, index) => {
              const run = runs[scenario.id];
              const verdict = run?.response ? evaluateScenario(scenario.id, run.response) : null;
              const active = selectedId === scenario.id;
              return (
                <div key={scenario.id} className={styles.scenarioRow} data-active={active}>
                  <button className={styles.selectScenario} type="button" onClick={() => setSelectedId(scenario.id)} aria-current={active ? "true" : undefined}>
                    <span className={styles.indexNumber}>{String(index + 1).padStart(2, "0")}</span>
                    <span className={styles.rowText}><strong>{scenario.title}</strong><small>{scenario.category}{scenario.reference ? " · baseline" : ""}</small></span>
                    <span className={styles.rowStatus} data-state={run?.error ? "error" : verdict ? verdict.passed ? "passed" : "failed" : "idle"}>
                      {run?.error ? "ERROR" : verdict ? verdict.passed ? "VERIFIED" : "FAILED" : "NOT RUN"}
                    </span>
                    <ArrowRight size={17} className={styles.rowArrow} aria-hidden="true" />
                  </button>
                  <button className={styles.runOne} type="button" onClick={() => runScenario(scenario.id)} disabled={runningId !== null || runningAll} aria-label={`Run ${scenario.title}`} title={`Run ${scenario.title}`}>
                    {runningId === scenario.id ? <RotateCcw size={16} className={styles.spinner} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section className={styles.dossier} aria-labelledby="dossier-heading">
          <div className={styles.dossierHeader}><span>SCENARIO DOSSIER</span><span>{selected.category.toUpperCase()}</span></div>
          <h2 id="dossier-heading">{selected.title}</h2>
          <p className={styles.attempt}>{selected.attempt}</p>
          <div className={styles.expectation}><span>EXPECTED RESPONSE</span><p>{selected.expected}</p></div>
          <div className={styles.resultHeader}><h3>Observed result</h3>{outcome ? <span data-pass={outcome.passed}>{outcome.passed ? <Check size={15} /> : <ShieldAlert size={15} />}{outcome.passed ? "VERIFIED" : "CHECK FAILED"}</span> : null}</div>
          {runningId === selectedId ? (
            <p className={styles.emptyResult} role="status">Executing the isolated scenario…</p>
          ) : selectedRun?.error ? (
            <div className={styles.failure} role="alert"><strong>Could not run this scenario</strong><p>{selectedRun.error}</p><p>Check the sandbox backend and try again. No result was inferred.</p></div>
          ) : outcome && selectedRun?.response ? (
            <div className={styles.evidence} aria-live="polite">
              <div className={styles.evidencePair}><span>ACTUAL</span><strong>{outcome.observed}</strong></div>
              <div className={styles.evidencePair}><span>REASON / RULE</span><code>{outcome.reason}</code></div>
              <div className={styles.evidencePair}><span>COMPLETED</span><strong>{selectedRun.response.completedAt ? new Date(selectedRun.response.completedAt).toLocaleString() : "Not returned"}</strong></div>
              {outcome.passed ? <div className={styles.checkList}>{outcome.checks.map((check) => <span key={check}><Check size={15} aria-hidden="true" />{check}</span>)}</div> : null}
              {trace.length > 0 ? <div className={styles.trace}><h4>Execution trace</h4><ol>{trace.map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}</ol></div> : null}
              <details className={styles.raw}><summary>View full backend response</summary><pre>{JSON.stringify(selectedRun.response, null, 2)}</pre></details>
            </div>
          ) : (
            <div className={styles.emptyResult}><p>No result yet. Run this scenario to see its decision, reason and execution trace.</p><button type="button" onClick={() => runScenario(selectedId)} disabled={runningId !== null || runningAll}>Run this scenario <ArrowRight size={16} aria-hidden="true" /></button></div>
          )}
        </section>
      </div>

      <footer className={styles.footer}><strong>Coverage note</strong><p>One-time step-up and concurrent reservation are described in the security brief but have no dedicated scenario endpoint yet. This page does not claim they were tested.</p></footer>
    </div>
  );
}
