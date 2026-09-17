import type { ReactNode } from "react";
import styles from "./TransactionReceipt.module.css";

export type TransactionReceiptProps = {
  id: string;
  agent: string;
  category: string;
  amount: string;
  constraint?: string;
  mandateRef?: string;
  stamp?: ReactNode;
  status?: "approved" | "stepup" | "denied";
  className?: string;
};

export function TransactionReceipt({
  id,
  agent,
  category,
  amount,
  constraint,
  mandateRef = "KP–1967–M",
  stamp,
  status = "approved",
  className = "",
}: TransactionReceiptProps) {
  return (
    <article
      className={`${styles.receipt} ${styles[status]} ${className}`}
      data-receipt={id}
      data-status={status}
    >
      <div className={styles.receiptBody}>
        {/* Receipt Header: Brand and Reference */}
        <header className={styles.header}>
          <div className={styles.brandRow}>
            <span className={styles.wordmark}>KavachPay</span>
            <span className={styles.txId}>{id}</span>
          </div>
          <div className={styles.subMeta}>
            <span className={styles.agentName}>{agent}</span>
            {constraint ? (
              <span className={styles.constraintBadge}>{constraint}</span>
            ) : (
              <span className={styles.mandateRef}>REF: {mandateRef}</span>
            )}
          </div>
        </header>

        {/* Amount & Category */}
        <div className={styles.amountSection}>
          <div className={styles.amountWrap}>
            <span className={styles.currencySymbol}>₹</span>
            <span className={styles.amountValue}>{amount.replace("₹", "")}</span>
          </div>
          <div className={styles.categoryBadge}>{category}</div>
        </div>

        {/* Stamp Slot (Placed cleanly in the lower right) */}
        {stamp && (
          <div className={styles.stampSlot} data-receipt-stamp>
            {stamp}
          </div>
        )}

        {/* Receipt Footer: Micro registration & Serration */}
        <footer className={styles.footer}>
          <span>REC // AUTH CHECK</span>
          <span>{mandateRef}</span>
        </footer>
      </div>
    </article>
  );
}
