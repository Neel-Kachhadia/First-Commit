import type { RefObject } from "react";
import styles from "./DirectorSlate.module.css";

type DirectorSlateProps = {
  containerRef: RefObject<HTMLDivElement | null>;
};

/**
 * Custom KavachPay production slate + hand-drawn "ACTION." grease-pencil mark.
 * Letterforms are authored monoline SVG paths (pathLength=1) so the GSAP timeline
 * in FilmIntro can draw them via strokeDashoffset — no script font, no fade-in.
 */
export function DirectorSlate({ containerRef }: DirectorSlateProps) {
  return (
    <div ref={containerRef} className={styles.stage} data-director-slate>
      <div className={styles.board} data-board>
        <div className={styles.clapper} data-clapper>
          <span className={styles.clapperLabel}>KAVACH PICTURES</span>
        </div>
        <div className={styles.fields}>
          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>PICTURE</span>
            <span className={styles.fieldValue}>KAVACHPAY</span>
          </div>
          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>PRODUCTION</span>
            <span className={styles.fieldValue} style={{ fontSize: "0.92rem" }}>
              THE FINANCIAL SYSTEM OF 2026
            </span>
          </div>
          <div className={styles.fieldGrid}>
            <div><span className={styles.fieldLabel}>SCENE</span><span className={styles.fieldValue}>00</span></div>
            <div><span className={styles.fieldLabel}>TAKE</span><span className={styles.fieldValue}>01</span></div>
            <div><span className={styles.fieldLabel}>ROLL</span><span className={styles.fieldValue}>KP-01</span></div>
          </div>
          <div className={styles.fieldGrid}>
            <div><span className={styles.fieldLabel}>DATE</span><span className={styles.fieldValue}>2026</span></div>
            <div><span className={styles.fieldLabel}>LOCATION</span><span className={styles.fieldValue}>BOMBAY</span></div>
          </div>
          <div className={styles.notation}>AUTHORITY / BOUNDED</div>
        </div>
      </div>

      <svg className={styles.actionSvg} viewBox="0 0 760 210" data-action-svg>
        {/* A */}
        <path
          className={styles.actionStroke}
          data-action-stroke
          pathLength={1}
          d="M 14 150 L 58 42 M 58 42 L 102 150 M 30 112 L 84 112"
        />
        {/* C */}
        <path
          className={styles.actionStroke}
          data-action-stroke
          pathLength={1}
          d="M 202 55 C 150 18 104 46 100 98 C 96 150 148 178 204 142"
        />
        {/* T */}
        <path
          className={styles.actionStroke}
          data-action-stroke
          pathLength={1}
          d="M 226 45 L 322 45 M 274 45 L 274 150"
        />
        {/* I */}
        <path
          className={styles.actionStroke}
          data-action-stroke
          pathLength={1}
          d="M 344 45 L 372 45 M 358 45 L 358 150 M 344 150 L 372 150"
        />
        {/* O */}
        <path
          className={styles.actionStroke}
          data-action-stroke
          pathLength={1}
          d="M 480 96 C 480 54 444 38 434 40 C 392 42 388 82 390 102 C 392 144 418 154 442 150 C 466 146 480 128 480 100"
        />
        {/* N */}
        <path
          className={styles.actionStroke}
          data-action-stroke
          pathLength={1}
          d="M 502 150 L 502 42 M 502 46 L 602 150 M 602 150 L 602 42"
        />
        {/* period */}
        <circle className={styles.actionPeriod} data-action-period cx="626" cy="150" r="9" />
        {/* strike / registration underline */}
        <path
          className={styles.actionUnderline}
          data-action-underline
          pathLength={1}
          d="M 18 178 C 110 180, 210 181, 310 181 C 365 181, 395 186, 420 191 C 430 193, 418 183, 410 181 C 430 180, 480 179, 535 177 C 600 174, 650 170, 680 167"
        />
      </svg>
    </div>
  );
}
