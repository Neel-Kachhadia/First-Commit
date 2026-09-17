import type { ReactNode } from "react";
import styles from "./ConcurrencySlip.module.css";

export type ConcurrencySlipProps = {
  id: string;
  amount: string;
  purpose: string;
  merchant: string;
  agent: string;
  time: string;
  serial: string;
  mandateRef?: string;
  status?: string;
  side: "left" | "right";
  className?: string;
  stamp?: ReactNode;
};

export function ConcurrencySlip({
  id,
  amount,
  purpose,
  merchant,
  agent,
  time,
  serial,
  mandateRef = "KP–1967–M",
  status = "PENDING CLAIM",
  side,
  className = "",
  stamp,
}: ConcurrencySlipProps) {
  return (
    <article
      className={`${styles.slip} ${styles[side]} ${className}`}
      data-concurrency-slip={id}
      data-slip-side={side}
      data-slip-id={id}
    >
      <div className={styles.slipInner}>
        {/* Header with Wordmark and Identifier */}
        <header className={styles.header}>
          <div className={styles.brandRow}>
            <span className={styles.wordmark}>KavachPay</span>
            <span className={styles.txId}>{id}</span>
          </div>
          <div className={styles.serialRow}>
            <span className={styles.serialText}>{serial}</span>
            <span className={styles.timeTag}>{time}</span>
          </div>
        </header>

        {/* Hero Amount & Category Display matching Panel 07 */}
        <div className={styles.heroBlock} data-slip-hero>
          <div className={styles.amountDisplay}>
            <span className={styles.currency}>₹</span>
            <span className={styles.amountNumeral}>{amount.replace("₹", "")}</span>
          </div>
          <div className={styles.purposeDisplay} data-slip-purpose>
            <span className={styles.purposeLabel}>{purpose}</span>
          </div>
        </div>

        {/* Administrative Details: Merchant & Agent */}
        <div className={styles.detailBlock}>
          <div className={styles.metaRow} data-slip-row="merchant">
            <span className={styles.metaKey}>MERCHANT</span>
            <span className={styles.metaVal}>{merchant}</span>
          </div>
          <div className={styles.metaRow} data-slip-row="agent">
            <span className={styles.metaKey}>AGENT</span>
            <span className={styles.metaVal}>{agent}</span>
          </div>
        </div>

        {/* Claim State Register */}
        <div className={styles.claimStatus} data-slip-status-wrap>
          <span className={styles.statusIndicator} data-status-indicator />
          <span className={styles.statusLabel} data-slip-status>
            {status}
          </span>
        </div>

        {/* Stamp Slot for Physical Stamping */}
        {stamp && <div className={styles.stampSlot}>{stamp}</div>}

        {/* Registration Alignment Notch */}
        <div
          className={`${styles.datumNotch} ${side === "left" ? styles.notchRight : styles.notchLeft}`}
          aria-hidden="true"
        >
          <span className={styles.notchTick} />
          <span className={styles.notchLabel}>{side === "left" ? "CLAIM →" : "← CLAIM"}</span>
        </div>

        {/* Footer: Provenance & Constraint */}
        <footer className={styles.footer}>
          <span className={styles.mandateBadge}>MANDATE {mandateRef}</span>
          <span className={styles.authorityCheck}>CAPACITY REQ: ₹500</span>
        </footer>
      </div>
    </article>
  );
}
