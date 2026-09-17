import type { ReactNode } from "react";
import styles from "./ClearanceDocument.module.css";

export type ClearanceDocumentProps = {
  id?: string;
  agent?: string;
  category?: string;
  amount?: string;
  limit?: string;
  requestedAuthority?: string;
  autoClearanceLimit?: string;
  excessAmount?: string;
  reference?: string;
  mandateRef?: string;
  route?: string;
  holdStamp?: ReactNode;
  clearOnceSeal?: ReactNode;
  className?: string;
};

export function ClearanceDocument({
  id = "TX–1082",
  agent = "TRAVEL AGENT",
  category = "TRAVEL",
  amount = "₹4,900",
  limit = "AUTOMATIC LIMIT ₹3,000",
  requestedAuthority = "REQUESTED AUTHORITY ₹4,900",
  autoClearanceLimit = "AUTO-CLEARANCE LIMIT ₹3,000",
  excessAmount = "EXCESS OVER LIMIT ₹1,900",
  reference = "AUTH–REQ–0401",
  mandateRef = "KP–1967–M",
  route = "AIRLINE // BOM → DEL",
  holdStamp,
  clearOnceSeal,
  className = "",
}: ClearanceDocumentProps) {
  return (
    <article
      className={`${styles.document} ${className}`}
      data-clearance-document
      aria-labelledby="clearance-doc-title"
    >
      {/* Corner alignment datums */}
      <span className={`${styles.cornerMark} ${styles.cornerTopLeft}`} data-corner-mark aria-hidden="true">⌜</span>
      <span className={`${styles.cornerMark} ${styles.cornerTopRight}`} data-corner-mark aria-hidden="true">⌝</span>
      <span className={`${styles.cornerMark} ${styles.cornerBottomLeft}`} data-corner-mark aria-hidden="true">⌞</span>
      <span className={`${styles.cornerMark} ${styles.cornerBottomRight}`} data-corner-mark aria-hidden="true">⌟</span>

      {/* Top Extension: Title & Pictogram banner unfolds when expanded */}
      <div className={styles.topExtension} data-doc-top-extension>
        <header className={styles.header}>
          <div className={styles.titleCol} data-doc-header-title>
            <h3 id="clearance-doc-title" className={styles.docTitle} aria-label="TRAVEL AUTHORIZATION REQUEST">
              <span>TRAVEL</span>
              <span>AUTHORIZATION</span>
              <span>REQUEST</span>
            </h3>
          </div>

          <div className={styles.pictogramBox} data-doc-pictogram aria-label="Travel pictogram">
            <svg
              className={styles.airplaneIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3.5c-.5-.5-2.5 0-4 1.5L13.5 8.5 5.3 6.7c-.8-.2-1.5.1-1.9.7l-.4.6 5.5 3.5L5 15l-2.5-.5-.8.8 2.8 2 2 2.8.8-.8-.5-2.5 3.5-3.5 3.5 5.5.6-.4c.6-.4.9-1.1.7-1.9z" fill="currentColor" />
            </svg>
          </div>
        </header>

        <div className={styles.divider} data-doc-divider />
      </div>

      {/* Central Identity Spine: Always present and continuous across all states */}
      <div className={styles.identitySpine} data-identity-spine>
        {/* Brand Wordmark & Serial Header */}
        <div className={styles.spineHeader} data-doc-brand>
          <div className={styles.brandGroup}>
            <span className={styles.wordmark}>KavachPay</span>
            <span className={styles.compactDocType} data-compact-doc-type>TRAVEL REQUEST SLIP</span>
          </div>
          <span className={styles.headerSerial}>{id}</span>
        </div>

        {/* Identity Sub-Meta Row */}
        <div className={styles.subMetaRow} data-doc-meta>
          <div className={styles.agentTag}>
            <span className={styles.agentLabel}>ISSUED TO:</span>
            <strong className={styles.agentValue}>{agent}</strong>
            <span className={styles.categoryBadge}>{category}</span>
          </div>
          <div className={styles.mandateTag}>
            <span>REF: {reference}</span>
            <span>·</span>
            <span>MANDATE: {mandateRef}</span>
          </div>
        </div>

        {/* Hero Amount & Route Info */}
        <section className={styles.amountSection} data-doc-amount-section>
          <div className={styles.routeTag}>
            <span className={styles.routeIndicator} />
            <span className={styles.routeText}>{route}</span>
          </div>

          <div className={styles.amountDisplay}>
            <span className={styles.currencySymbol}>₹</span>
            <span className={styles.amountValue}>{amount.replace("₹", "")}</span>
          </div>

          <div className={styles.limitRuleBox}>
            <span className={styles.limitRuleText}>{limit}</span>
          </div>
        </section>

        {/* Compact Cleared Badge (Shows on compact slip after clearance) */}
        <div className={styles.compactClearedBadge} data-compact-cleared-badge>
          <span className={styles.compactClearedDot} />
          <span className={styles.compactClearedText}>ONE-TIME CLEARANCE GRANTED // {id} RELEASED</span>
        </div>
      </div>

      {/* Bottom Extension: Unfolds when expanded at datum */}
      <div className={styles.bottomExtension} data-doc-bottom-extension>
        {/* Authority Comparison Ledger (Requested vs Automatic Limit) */}
        <div className={styles.comparisonLedger} data-comparison-ledger>
          <div className={styles.ledgerRow}>
            <span className={styles.ledgerKey}>REQUESTED AUTHORITY</span>
            <span className={styles.ledgerDotRule} />
            <span className={styles.ledgerVal}>{requestedAuthority.replace("REQUESTED AUTHORITY ", "")}</span>
          </div>
          <div className={styles.ledgerRow}>
            <span className={styles.ledgerKey}>AUTO-CLEARANCE LIMIT</span>
            <span className={styles.ledgerDotRule} />
            <span className={styles.ledgerVal}>{autoClearanceLimit.replace("AUTO-CLEARANCE LIMIT ", "")}</span>
          </div>
          <div className={`${styles.ledgerRow} ${styles.ledgerExcess}`}>
            <span className={styles.ledgerKey}>AUTHORITY GAP (EXCESS)</span>
            <span className={styles.ledgerDotRule} />
            <span className={styles.ledgerValHighlight}>{excessAmount.replace("EXCESS OVER LIMIT ", "")}</span>
          </div>
        </div>

        {/* Stamp Area: Slanted Red HOLD FOR CLEARANCE Stamp */}
        <div className={styles.stampArea} data-doc-stamp-area>
          {holdStamp}
          <div className={styles.referralNotice} data-referral-notice>
            <span className={styles.referralQuote}>“</span>
            <span className={styles.referralText}>REFER FOR APPROVAL</span>
            <span className={styles.referralQuote}>”</span>
          </div>
        </div>

        {/* Action Controls Split Box (CLEAR ONCE / DECLINE) */}
        <div className={styles.actionControls} data-action-controls>
          <div className={styles.actionBoxClear} data-action-clear-box>
            <div className={styles.actionClearHeader}>
              <span className={styles.actionClearLabel}>CLEAR ONCE</span>
              <span className={styles.actionClearBadge}>SINGLE-USE</span>
            </div>
            <span className={styles.actionClearSub}>NARROW PERMISSION // THIS TRANSACTION ONLY</span>
            {clearOnceSeal && (
              <div className={styles.clearSealSlot} data-clear-seal-slot>
                {clearOnceSeal}
              </div>
            )}
          </div>

          <div className={styles.actionBoxDecline} data-action-decline-box>
            <span className={styles.actionDeclineLabel}>DECLINE</span>
            <span className={styles.actionDeclineSub}>TERMINATE EXECUTION</span>
          </div>
        </div>

        {/* Document Footer: Institutional Tagline */}
        <footer className={styles.footer} data-doc-footer>
          <div className={styles.footerLeft}>
            <span className={styles.footerBrand}>KAVACHPAY</span>
            <span className={styles.footerDivider}>{"//"}</span>
            <span className={styles.footerMicro}>HIGHER INTENT. HUMAN CLEARANCE.</span>
          </div>
          <span className={styles.footerTagline}>SAME MONEY. A SAFER TOMORROW.</span>
        </footer>
      </div>
    </article>
  );
}
