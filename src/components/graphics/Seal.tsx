import styles from "./Seal.module.css";

type SealProps = React.SVGProps<SVGSVGElement> & {
  className?: string;
  label?: string;
};

export function Seal({ className = "", label = "KavachPay authority seal", ...rest }: SealProps) {
  return (
    <svg
      aria-label={label}
      className={`${styles.seal} ${className}`}
      role="img"
      viewBox="0 0 160 160"
      {...rest}
    >
      <circle className={styles.outer} cx="80" cy="80" r="70" />
      <circle className={styles.inner} cx="80" cy="80" r="54" />
      <path className={styles.ticks} d="M80 16v12M80 132v12M16 80h12M132 80h12M35 35l9 9M116 116l9 9M125 35l-9 9M44 116l-9 9" />
      <path className={styles.k} d="M55 50v60M58 81l37-31M59 80l39 30" />
      <path className={styles.p} d="M101 110V50h16c17 0 22 22 8 31-6 4-13 3-24 3" />
      <text className={styles.topText} x="80" y="39" textAnchor="middle">BOUND AUTHORITY</text>
      <text className={styles.bottomText} x="80" y="132" textAnchor="middle">KAVACHPAY • 1967</text>
    </svg>
  );
}
