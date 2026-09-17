import styles from "./DecisionStamp.module.css";

type DecisionStampProps = {
  children: React.ReactNode;
  className?: string;
  tone?: "red" | "green" | "ink";
};

export function DecisionStamp({ children, className = "", tone = "red" }: DecisionStampProps) {
  return (
    <span className={`${styles.stamp} ${styles[tone]} ${className}`}>
      <span>{children}</span>
    </span>
  );
}
