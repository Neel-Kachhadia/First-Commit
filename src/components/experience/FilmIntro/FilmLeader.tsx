import type { RefObject } from "react";
import styles from "./FilmLeader.module.css";

type FilmLeaderProps = {
  containerRef: RefObject<HTMLDivElement | null>;
};

/** Optical countdown leader: rings, timing wedge, one numeral swapped imperatively by the GSAP timeline in FilmIntro. */
export function FilmLeader({ containerRef }: FilmLeaderProps) {
  return (
    <div ref={containerRef} className={styles.leader} data-film-leader>
      <div className={styles.registration}>
        <div className={styles.ring} />
        <div className={styles.crosshairV} />
        <div className={styles.crosshairH} />
        <div className={styles.wedge} data-wedge />
      </div>
      <span className={styles.numeral} data-numeral>3</span>
      <div className={styles.edgeMarkTop}>FRAME&nbsp;&nbsp;ROLL KP-01&nbsp;&nbsp;START</div>
      <div className={styles.edgeMarkBottom}>PICTURE START</div>
      <div className={styles.splice} data-splice />
      <div className={styles.scratchA} />
      <div className={styles.scratchB} />
      <div className={styles.dust} />
      <div className={styles.frameAdvanceFlash} data-frame-advance />
    </div>
  );
}
