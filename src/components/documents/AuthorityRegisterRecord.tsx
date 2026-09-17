import styles from "./AuthorityRegisterRecord.module.css";

export type AuthorityRegisterRecordProps = {
  variant: "source" | "dependent" | "control";
  id: string;
  agent: string;
  category: string;
  limit: string;
  mandateRef: string;
  derivedFrom?: string;
  role: string;
  initialStatus: string;
  serialKey: string;
  /** Overrides what's shown as the primary identity chip; `id` still drives DOM wiring/selectors. */
  displayId?: string;
  /** Secondary reference shown beneath the role tag (e.g. a transaction ref, not an authority ID). */
  secondaryRef?: string;
  className?: string;
};

export function AuthorityRegisterRecord({
  variant,
  id,
  agent,
  category,
  limit,
  mandateRef,
  derivedFrom,
  role,
  initialStatus,
  serialKey,
  displayId,
  secondaryRef,
  className = "",
}: AuthorityRegisterRecordProps) {
  const variantClass =
    variant === "source"
      ? styles.sourceRecord
      : variant === "dependent"
        ? styles.dependentRecord
        : styles.controlRecord;

  return (
    <article
      className={`${styles.record} ${variantClass} ${className}`}
      data-record={id}
      data-record-role={variant}
      aria-label={`${agent}, ${category} Authority Record: ${displayId ?? id}`}
    >
      {/* Corner crosshairs */}
      <span className={`${styles.cornerMark} ${styles.cornerTopLeft}`} aria-hidden="true">+</span>
      <span className={`${styles.cornerMark} ${styles.cornerTopRight}`} aria-hidden="true">+</span>
      <span className={`${styles.cornerMark} ${styles.cornerBottomLeft}`} aria-hidden="true">+</span>
      <span className={`${styles.cornerMark} ${styles.cornerBottomRight}`} aria-hidden="true">+</span>

      {/* 1. Physical Registration Spine / Band (Aligned Left Registration Axis) */}
      <div className={styles.colSpine} data-spine-column={id}>
        {variant === "source" && (
          <div className={styles.recallChannel} aria-hidden="true">
            <div className={styles.recallChannelFade} />
          </div>
        )}
        <div className={styles.spineSocketTrack}>
          <div className={styles.socketTeeth} aria-hidden="true" />
          {variant === "source" && (
            <span className={styles.socketEmptyNotice} data-socket-notice aria-hidden="true">
              SOCKET: EMPTY // WITHDRAWN
            </span>
          )}
        </div>

        {/* Top meta row */}
        <div className={styles.spineMetaRow}>
          <span className={styles.spineDatumPip}>
            <span className={styles.pipDot} aria-hidden="true" />
            <span>DATUM 05</span>
          </span>
          <span className={styles.spineSerialKey}>{serialKey}</span>
        </div>

        {/* Mechanical Sliding Elements */}
        {variant === "source" && (
          <div className={styles.sourceSpineCarriage} data-source-spine>
            <span className={styles.carriageTitle}>SOURCE REGISTRATION SPINE</span>
            <div className={styles.carriageDatumNotch} aria-hidden="true">
              <span data-notch-status>LOCKED</span>
              <span className={styles.notchBar} data-notch-bar />
            </div>
          </div>
        )}

        {variant === "dependent" && (
          <div className={styles.inheritedRegisterBand} data-inherited-register={id}>
            <span className={styles.inheritedLabel}>INHERITED PROVENANCE BAND</span>
            <div className={styles.inheritedPin} aria-hidden="true" />
          </div>
        )}

        {variant === "control" && (
          <div className={styles.independentRegisterTrack} data-independent-register="travel">
            <span className={styles.independentLabel}>INDEPENDENT LINEAGE TRACK</span>
            <span className={styles.independentPip} aria-hidden="true" />
          </div>
        )}
      </div>

      {/* 2. Identity & Serial */}
      <div className={styles.colIdentity}>
        <span className={styles.serialPrefix}>REG // {variant.toUpperCase()}</span>
        <strong className={styles.serialId} data-record-serial={id}>{displayId ?? id}</strong>
        <span className={styles.roleTag}>{role}</span>
        {secondaryRef && (
          <span className={styles.secondaryRef} data-record-secondary-ref={id}>
            TX REF: {secondaryRef}
          </span>
        )}
      </div>

      {/* 3. Authority & Lineage */}
      <div className={styles.colDetails}>
        <h3 className={styles.categoryTitle}>{category}</h3>
        <div className={styles.lineageInfo}>
          <strong className={styles.limitValue}>{limit}</strong>
          <span>·</span>
          {derivedFrom ? (
            <span data-lineage-derived={id}>FROM: {derivedFrom}</span>
          ) : (
            <span>MANDATE: {mandateRef}</span>
          )}
        </div>
      </div>

      {/* 4. State Chamber Column */}
      <div className={styles.colState}>
        <div className={styles.stateChamber} data-state-chamber={id}>
          <span className={styles.stateLabel}>STATUS</span>
          <strong className={styles.stateValue} data-state-value={id}>{initialStatus}</strong>
        </div>

        {/* Historical stamp impressions */}
        {variant === "source" && (
          <div className={styles.stampOverlay} data-stamp-revoked>
            REVOKED
          </div>
        )}

        {variant === "dependent" && (
          <div
            className={`${styles.stampOverlay} ${styles.stampWithdrawn}`}
            data-stamp-withdrawn={id}
          >
            WITHDRAWN
          </div>
        )}
      </div>
    </article>
  );
}
