import type { ReactNode } from "react";
import styles from "./AuthorityPass.module.css";

export type AuthorityPassProps = {
  id: string;
  role: "parent" | "derived" | "downstream";
  category: string;
  amount?: string;
  reference?: string;
  derivedFrom?: string;
  level?: number;
  levelLabel?: string;
  remainingLabel?: string;
  depthRule?: string;
  totalLimit?: string;
  allocated?: string;
  remaining?: string;
  className?: string;
  children?: ReactNode;
};

export function AuthorityPass({
  id,
  role,
  category,
  amount,
  reference = "KP–1967–M",
  derivedFrom,
  level,
  levelLabel,
  remainingLabel,
  depthRule = "2 LEVELS MAX",
  totalLimit = "₹4,000",
  allocated = "₹0",
  remaining = "₹4,000",
  className = "",
  children,
}: AuthorityPassProps) {
  if (role === "parent") {
    return (
      <article
        className={`${styles.pass} ${styles.parentPass} ${className}`}
        data-pass={id}
        data-role="parent"
        data-level={level ?? 0}
        data-parent-stock
        aria-label={`Parent Authority Pass: ${category} ${totalLimit}`}
      >
        {/* Decorative corner staples / registration marks */}
        <span className={`${styles.cornerMark} ${styles.cornerTopLeft}`} aria-hidden="true">+</span>
        <span className={`${styles.cornerMark} ${styles.cornerTopRight}`} aria-hidden="true">+</span>
        <span className={`${styles.cornerMark} ${styles.cornerBottomLeft}`} aria-hidden="true">+</span>
        <span className={`${styles.cornerMark} ${styles.cornerBottomRight}`} aria-hidden="true">+</span>

        <header className={styles.header} data-parent-serial>
          <div className={styles.headerMetaRow}>
            <div className={styles.authoritySerial}>
              <span className={styles.serialPrefix}>PASS //</span>
              <strong className={styles.serialId}>{id}</strong>
            </div>
            <div className={styles.depthTag} data-parent-depth-tag>
              <span className={styles.depthLabel}>DELEGATION</span>
              <strong className={styles.depthValue}>{depthRule}</strong>
            </div>
            <div className={styles.mandateRef}>
              <span className={styles.refLabel}>ROOT MANDATE:</span>
              <span className={styles.refValue}>{reference}</span>
            </div>
          </div>
          <div className={styles.ruleDivider} />
        </header>

        <div className={styles.body}>
          <div className={styles.categoryRow} data-parent-category>
            <span className={styles.typeEyebrow}>PARENT AUTHORITY // SOURCE</span>
            <h3 className={styles.categoryTitle}>{category}</h3>
          </div>

          <div className={styles.limitRow} data-parent-amount>
            <div className={styles.limitValueWrap}>
              <span className={styles.limitCurrency}>₹</span>
              <span className={styles.limitAmount}>4,000</span>
              <span className={styles.limitPeriod}>/ WEEK</span>
            </div>
            <div className={styles.statusBadge}>ACTIVE CONTRACT</div>
          </div>

          {/* Institutional Accounting Ledger Register */}
          <div className={styles.accountingPanel} data-parent-accounting>
            <div className={styles.accountingHeader}>
              <span className={styles.accountingTitle}>AUTHORITY ALLOCATION</span>
              <span className={styles.accountingLedgerCode}>LEDGER // DERIVATION</span>
            </div>

            <div className={styles.ledgerBlock}>
              <div className={styles.ledgerRow}>
                <span className={styles.ledgerLabel}>TOTAL</span>
                <span className={styles.ledgerRule} aria-hidden="true" />
                <strong className={styles.ledgerValue}>{totalLimit}</strong>
              </div>
              <div className={styles.ledgerRow}>
                <span className={styles.ledgerLabel}>DELEGATED</span>
                <span className={styles.ledgerRule} aria-hidden="true" />
                <strong className={`${styles.ledgerValue} ${styles.ledgerDelegated}`} data-accounting-allocated>
                  {allocated}
                </strong>
              </div>
              <div className={styles.ledgerRow}>
                <span className={styles.ledgerLabel}>REMAINING</span>
                <span className={styles.ledgerRule} aria-hidden="true" />
                <strong className={`${styles.ledgerValue} ${styles.ledgerRemaining}`} data-accounting-remaining>
                  {remaining}
                </strong>
              </div>
            </div>

            {/* Delegation event log — entries appear as derivations happen */}
            <div className={styles.ledgerIndex} data-ledger-index>
              <div className={styles.ledgerEntry} data-ledger-entry="1">
                <span className={styles.entryNumber}>01</span>
                <span className={styles.entryRef}>AUTH–0302</span>
                <span className={styles.entryAmount}>₹1,500</span>
              </div>
              <div className={styles.ledgerEntry} data-ledger-entry="2">
                <span className={styles.entryNumber}>02</span>
                <span className={styles.entryRef}>AUTH–0303</span>
                <span className={styles.entryAmount}>₹1,000</span>
              </div>
            </div>
          </div>
        </div>

        {/* Continuous Allocation Stock Band — derivable authority material */}
        <div className={styles.allocationStock} data-allocation-stock>
          <div className={styles.stockHeader}>
            <span className={styles.stockLabel}>AVAILABLE DERIVATION STOCK</span>
            <span className={styles.stockCapacity} data-stock-capacity>₹4,000 UNALLOCATED</span>
          </div>
          <div className={styles.stockMaterial} data-stock-material>
            {/* Temporary registration boundary for Grocery derivation */}
            <div className={styles.registrationFrame} data-registration-frame="grocery">
              <div className={styles.frameTick} data-frame-tick="tl" />
              <div className={styles.frameTick} data-frame-tick="tr" />
              <div className={styles.frameTick} data-frame-tick="bl" />
              <div className={styles.frameTick} data-frame-tick="br" />
              <div className={styles.framePerf} data-frame-perf="grocery" />
              <div className={styles.frameRegistration} data-frame-text="grocery">
                <span className={styles.frameLabel}>GROCERY</span>
                <span className={styles.frameAmount}>₹1,500 / WEEK</span>
              </div>
            </div>
            {/* Temporary registration boundary for Delivery derivation */}
            <div className={styles.registrationFrame} data-registration-frame="delivery">
              <div className={styles.frameTick} data-frame-tick="tl" />
              <div className={styles.frameTick} data-frame-tick="tr" />
              <div className={styles.frameTick} data-frame-tick="bl" />
              <div className={styles.frameTick} data-frame-tick="br" />
              <div className={styles.framePerf} data-frame-perf="delivery" />
              <div className={styles.frameRegistration} data-frame-text="delivery">
                <span className={styles.frameLabel}>DELIVERY</span>
                <span className={styles.frameAmount}>₹1,000 / WEEK</span>
              </div>
            </div>
          </div>
        </div>

        {/* Perforation scar / allocation residue — appears after derivation */}
        <div className={styles.allocationResidue} data-allocation-residue>
          <div className={styles.residueScar} data-residue-scar="1">
            <span className={styles.scarMark}>DELEGATED</span>
            <span className={styles.scarRef}>₹1,500 · AUTH–0302</span>
          </div>
          <div className={styles.residueScar} data-residue-scar="2">
            <span className={styles.scarMark}>DELEGATED</span>
            <span className={styles.scarRef}>₹1,000 · AUTH–0303</span>
          </div>
        </div>

        {/* Perforation guide along side edges */}
        <div className={styles.perforationLeft} data-perforation="left" aria-hidden="true" />
        <div className={styles.perforationRight} data-perforation="right" aria-hidden="true" />

        <footer className={styles.footer}>
          <span className={styles.footerSeal}>KAVACHPAY MONETARY CONTROL</span>
          <span className={styles.footerAudit}>DERIVATION PERMITTED · CANNOT MULTIPLY</span>
        </footer>

        {children}
      </article>
    );
  }

  if (role === "downstream") {
    return (
      <article
        className={`${styles.pass} ${styles.downstreamPass} ${className}`}
        data-pass={id}
        data-role="downstream"
        data-level={2}
        aria-label="Level 2 Downstream Pass: Secondary Delegation Derived From Grocery"
      >
        <header className={styles.header}>
          <div className={styles.headerMetaRow}>
            <div className={styles.authoritySerial}>
              <span className={styles.serialPrefix}>DOWNSTREAM //</span>
              <strong className={styles.serialId}>{id}</strong>
            </div>
            <div className={styles.levelBadgeDownstream}>
              <span className={styles.levelNum}>{levelLabel ?? "LEVEL 2 OF 2"}</span>
            </div>
          </div>
        </header>

        <div className={styles.downstreamBody}>
          <div className={styles.categoryRow}>
            <span className={styles.typeEyebrow}>SECONDARY DELEGATION</span>
            <h4 className={styles.downstreamTitle}>{category}</h4>
          </div>

          <div className={styles.provenanceBox}>
            <span className={styles.provenanceLabel}>DERIVED FROM:</span>
            <span className={styles.provenanceTarget}>{derivedFrom}</span>
          </div>

          {/* Compact Dedicated Boundary Region (Constraint 14) */}
          <div className={styles.depthBoundaryRegion}>
            {/* Attempted Level-3 registration & perforation line */}
            <div className={styles.nextLevelZone} data-next-level-zone aria-hidden="true">
              <div className={styles.nextLevelPerf} data-next-level-perf />
              <span className={styles.nextLevelLabel}>ATTEMPT: LEVEL 3 REGISTRATION</span>
            </div>

            {/* Sealed Seam Boundary */}
            <div className={styles.sealedSeam} data-sealed-boundary>
              <div className={styles.sealedRule} />
              <div className={styles.sealedStamp}>
                <span className={styles.sealedBracket}>[</span>
                <span className={styles.sealedText}>2 LEVELS MAX // NO FURTHER DELEGATION</span>
                <span className={styles.sealedBracket}>]</span>
              </div>
              <span className={styles.sealedSub}>SEAM SEALED</span>
            </div>
          </div>
        </div>

        {children}
      </article>
    );
  }

  // Derived Authority Pass (Grocery, Delivery - Level 1)
  return (
    <article
      className={`${styles.pass} ${styles.derivedPass} ${className}`}
      data-pass={id}
      data-role="derived"
      data-level={level ?? 1}
      aria-label={`Derived Authority: ${category} ${amount}`}
    >
      <header className={styles.header}>
        <div className={styles.headerMetaRow}>
          <div className={styles.authoritySerial}>
            <span className={styles.serialPrefix}>DERIVED //</span>
            <strong className={styles.serialId}>{id}</strong>
          </div>
          <div className={styles.levelBadge}>
            <span className={styles.levelNum}>{levelLabel ?? "LEVEL 1 OF 2"}</span>
          </div>
        </div>
        <div className={styles.ruleDivider} />
      </header>

      <div className={styles.body}>
        <div className={styles.categoryRow}>
          <span className={styles.typeEyebrow}>DERIVED AUTHORITY PASS</span>
          <h4 className={styles.categoryTitleDerived}>{category}</h4>
        </div>

        <div className={styles.limitRowDerived}>
          <div className={styles.limitValueWrapDerived}>
            <span className={styles.limitCurrencyDerived}>₹</span>
            <span className={styles.limitAmountDerived}>
              {amount ? amount.replace("₹", "").split("/")[0].trim() : "0"}
            </span>
            <span className={styles.limitPeriodDerived}>/ WEEK</span>
          </div>
          <div className={styles.allowancePill}>BOUNDED SUBSET</div>
        </div>

        {/* Provenance & Parent Reference */}
        <div className={styles.provenanceBox}>
          <div className={styles.provenanceItem}>
            <span className={styles.provenanceLabel}>DERIVED FROM:</span>
            <strong className={styles.provenanceTarget}>{derivedFrom}</strong>
          </div>
          <div className={styles.provenanceItem}>
            <span className={styles.provenanceLabel}>DELEGATION:</span>
            <strong className={styles.remainingLabel}>{remainingLabel ?? "1 LEVEL REMAINING"}</strong>
          </div>
        </div>
      </div>

      {/* Perforated Edge Indicator showing physical detachment */}
      <div className={styles.tearBorder} aria-hidden="true" />

      <footer className={styles.footerDerived}>
        <span className={styles.footerTag}>PROVENANCE PRESERVED</span>
        <span className={styles.footerSerial}>KP–AUTH–V1</span>
      </footer>

      {children}
    </article>
  );
}
