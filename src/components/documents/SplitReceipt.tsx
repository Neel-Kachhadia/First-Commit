import type { ReactNode } from "react";
import styles from "./SplitReceipt.module.css";

export type SplitReceiptProps = {
  id: string;
  amount: string;
  time: string;
  merchant: string;
  location: string;
  agent: string;
  purpose: string;
  status?: string;
  serial?: string;
  mandateRef?: string;
  stamp?: ReactNode;
  className?: string;
  index?: number;
};

export function SplitReceipt({
  id,
  amount,
  time,
  merchant,
  location,
  agent,
  purpose,
  status = "SUB-THRESHOLD",
  serial,
  mandateRef = "KP–1967–M",
  stamp,
  className = "",
  index = 0,
}: SplitReceiptProps) {
  return (
    <article
      className={`${styles.receipt} ${className}`}
      data-split-receipt={id}
      data-receipt-index={index}
      data-time={time}
    >
      <div className={styles.receiptBody}>
        {/* Top Header: Brand Wordmark & ID */}
        <header className={styles.header}>
          <div className={styles.brandRow}>
            <span className={styles.wordmark}>KavachPay</span>
            <span className={styles.txId}>{id}</span>
          </div>
          {serial && <div className={styles.serialRow}>{serial}</div>}
        </header>

        {/* Merchant Block — Registration Row 1 */}
        <div className={styles.merchantBlock} data-register-row="merchant">
          <div className={styles.registerTarget} aria-hidden="true" />
          <span className={styles.merchantName}>{merchant}</span>
          <span className={styles.location}>{location}</span>
        </div>

        {/* Amount & Time Display */}
        <div className={styles.amountSection} data-register-row="amount">
          <div className={styles.amountWrap}>
            <span className={styles.currency}>₹</span>
            <span className={styles.amountVal}>{amount.replace("₹", "")}</span>
          </div>
          <div className={styles.timeTag} data-time-tag={time}>
            <span className={styles.timeLabel}>TIME</span>
            <span className={styles.timeVal}>{time}</span>
          </div>
        </div>

        {/* Sub-threshold Status Bar */}
        <div className={styles.thresholdNotice} data-threshold-notice>
          <span className={styles.thresholdDot} />
          <span className={styles.thresholdText}>{status}</span>
        </div>

        {/* Agent Block — Registration Row 2 */}
        <div className={styles.metaRow} data-register-row="agent">
          <div className={styles.registerTarget} aria-hidden="true" />
          <span className={styles.metaLabel}>ORIGINATING AGENT</span>
          <span className={styles.metaValue}>{agent}</span>
        </div>

        {/* Purpose Block — Registration Row 3 */}
        <div className={styles.metaRow} data-register-row="purpose">
          <div className={styles.registerTarget} aria-hidden="true" />
          <span className={styles.metaLabel}>PAYMENT PURPOSE</span>
          <span className={styles.metaValue}>{purpose}</span>
        </div>

        {/* Stamp Slot */}
        {stamp && <div className={styles.stampSlot}>{stamp}</div>}

        {/* Footer: Mandate provenance & perforation */}
        <footer className={styles.footer}>
          <span className={styles.mandateBadge}>MANDATE: {mandateRef}</span>
          <span className={styles.authCheck}>CH-REQ // VALID</span>
        </footer>
      </div>
    </article>
  );
}
