"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  detectCardNetwork,
  formatCardFace,
  formatExpiry,
  isCompleteCardNumber,
  isFutureExpiry,
} from "@/lib/card-preview";
import styles from "./CardPreviewPage.module.css";

export function CardPreviewPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [side, setSide] = useState<"front" | "back">("front");
  const network = detectCardNetwork(number);
  const cvcLength = network === "American Express" ? 4 : 3;
  const validNumber = isCompleteCardNumber(number);
  const validExpiry = isFutureExpiry(expiry);
  const ready = name.trim().length > 0 && validNumber && validExpiry && cvc.length === cvcLength;

  const changeNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 19);
    setNumber(digits);
    setCvc("");
    setSide("front");
  };

  const finish = () => {
    if (!ready) return;
    // Clear the transient demo values before leaving; nothing is persisted or sent.
    setName("");
    setNumber("");
    setExpiry("");
    setCvc("");
    router.push("/auth");
  };

  return (
    <main className={styles.root}>
      <div className={styles.filmEdge} aria-hidden="true"><span /><span /><span /><span /><span /><span /></div>
      <div className={styles.content}>
        <header className={styles.header}>
          <Link href="/" className={styles.brand}>KavachPay</Link>
          <Link href="/auth" className={styles.signInLink}>Skip preview and sign in ↗</Link>
        </header>

        <div className={styles.layout}>
          <section className={styles.intro} aria-labelledby="preview-title">
            <span className={styles.eyebrow}>INTERACTIVE CARD PREVIEW</span>
            <h1 id="preview-title">The card, <em>from both sides.</em></h1>
            <p>Type a card number to see its shape and likely network. Focus the expiry or security code to turn the card over.</p>
            <div className={styles.notice} role="note">
              <strong>Visual preview only</strong>
              <span>No payment method is connected. Do not enter live card details; nothing here is charged, transmitted, or saved.</span>
            </div>
          </section>

          <section className={styles.workbench} aria-label="Card preview">
            <div className={styles.specimenTop}><span>CARD PREVIEW</span><span>NO PAYMENT CONNECTION</span></div>
            <div className={styles.previewStage}>
              <div className={styles.cardRotator} data-side={side}>
                <div className={`${styles.previewCard} ${styles.front}`} aria-hidden={side === "back"}>
                  <div className={styles.cardTop}><span className={styles.cardWordmark}>KavachPay</span><span className={styles.network}>{network ?? "CARD"}</span></div>
                  <div className={styles.cardStroke} aria-hidden="true" />
                  <div className={styles.cardNumber}>{formatCardFace(number)}</div>
                  <div className={styles.cardBottom}><span>{name.trim() || "CARDHOLDER NAME"}</span><span>KP</span></div>
                </div>
                <div className={`${styles.previewCard} ${styles.back}`} aria-hidden={side === "front"}>
                  <div className={styles.magneticStrip} />
                  <div className={styles.backContent}>
                    <div><small>EXPIRES</small><strong>{expiry || "MM/YY"}</strong></div>
                    <div className={styles.signature}><small>SECURITY CODE</small><strong>{"•".repeat(cvc.length).padEnd(cvcLength, "–")}</strong></div>
                  </div>
                  <div className={styles.backFooter}><span>KavachPay</span><span>AUTHORITY FIRST</span></div>
                </div>
              </div>
            </div>
            <div className={styles.sideControls} aria-label="Preview card side">
              <button type="button" aria-pressed={side === "front"} onClick={() => setSide("front")}>Front</button>
              <button type="button" aria-pressed={side === "back"} onClick={() => setSide("back")}>Back</button>
            </div>

            <div className={styles.fields}>
              <label htmlFor="demo-name">Name on card</label>
              <input id="demo-name" value={name} onFocus={() => setSide("front")} onChange={(event) => setName(event.target.value.slice(0, 32))} autoComplete="off" placeholder="Sample name" />

              <label htmlFor="demo-number">Card number</label>
              <input id="demo-number" value={number} onFocus={() => setSide("front")} onChange={(event) => changeNumber(event.target.value)} inputMode="numeric" autoComplete="off" maxLength={19} placeholder="Enter up to 19 digits" aria-describedby="number-hint" />
              <p id="number-hint" className={styles.hint} aria-live="polite">
                {network ? `${network} prefix recognised. Network is an estimate, not card verification.` : "Any number can be previewed. Known networks appear as you type."}
              </p>

              <div className={styles.fieldPair}>
                <div>
                  <label htmlFor="demo-expiry">Expiry</label>
                  <input id="demo-expiry" value={expiry} onFocus={() => setSide("back")} onChange={(event) => setExpiry(formatExpiry(event.target.value))} inputMode="numeric" autoComplete="off" maxLength={5} placeholder="MM/YY" aria-describedby="expiry-hint" />
                </div>
                <div>
                  <label htmlFor="demo-cvc">Security code</label>
                  <input id="demo-cvc" type="password" value={cvc} onFocus={() => setSide("back")} onChange={(event) => setCvc(event.target.value.replace(/\D/g, "").slice(0, cvcLength))} inputMode="numeric" autoComplete="off" maxLength={cvcLength} placeholder={"•".repeat(cvcLength)} aria-describedby="cvc-hint" />
                </div>
              </div>
              <p id="expiry-hint" className={styles.hint}>{expiry && !validExpiry ? "Enter a valid future month and year." : "Focus either field to turn the card over."}</p>
              <p id="cvc-hint" className={styles.srOnly}>{`Enter ${cvcLength} security code digits for the preview.`}</p>
            </div>
            <button type="button" className={styles.continue} onClick={finish} disabled={!ready}>Finish preview and sign in <span aria-hidden="true">↗</span></button>
          </section>
        </div>
        <footer className={styles.footer}><span>VISUAL PREVIEW / NO CARD LINKED</span><span>© KAVACHPAY</span></footer>
      </div>
    </main>
  );
}
