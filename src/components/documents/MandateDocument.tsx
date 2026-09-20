import { mandateDemo } from "@/lib/experience/demo-state";
import { DecisionStamp } from "@/components/graphics/DecisionStamp";
import { Seal } from "@/components/graphics/Seal";
import styles from "./MandateDocument.module.css";

type FieldProps = {
  fieldKey: string;
  label: string;
  value: string;
  danger?: boolean;
  className?: string;
};

function MandateField({ fieldKey, label, value, danger = false, className = "" }: FieldProps) {
  return (
    <div className={`${styles.field} ${className}`} data-mandate-field={fieldKey}>
      <dt data-mandate-field-label>{label}</dt>
      <dd data-mandate-field-val className={danger ? styles.danger : undefined}>{value}</dd>
    </div>
  );
}

export function MandateDocument() {
  return (
    <article className={styles.document} aria-label="KavachPay grocery spending mandate">
      <div className={styles.hole} data-mandate-hole aria-hidden="true"><i /></div>

      <header className={styles.header} data-mandate-header>
        <span className={styles.brand}>KavachPay</span>
        <span className={styles.ref}>{mandateDemo.reference}</span>
      </header>

      <div className={styles.typeRow} data-mandate-header>
        <span>SPENDING MANDATE</span>
        <span>01-BOUND</span>
      </div>

      <h3 className={styles.category} data-mandate-category>{mandateDemo.category}</h3>

      <dl className={styles.fields}>
        <MandateField fieldKey="limit" label="LIMIT" value={mandateDemo.weeklyLimit} />
        <MandateField fieldKey="stepup" label="STEP-UP" value={mandateDemo.stepUpAbove} />
        <MandateField fieldKey="blocked" label="NO" value={mandateDemo.blockedCategory} danger />
        <MandateField fieldKey="expires" label="EXPIRES" value={mandateDemo.expires} />
        <MandateField fieldKey="delegation" label="DELEGATION" value={`${mandateDemo.delegationDepth} LEVELS MAX`} />
      </dl>

      <div className={styles.restriction} data-mandate-stamp>
        <DecisionStamp>Category<br />Blocked</DecisionStamp>
      </div>

      <footer className={styles.footer}>
        <p data-mandate-footer>SAME MONEY.<br />A SAFER TOMORROW.</p>
        <Seal className={styles.seal} data-mandate-seal />
        <p data-mandate-footer>TRUST<br />TRAVELS<br />FURTHER</p>
      </footer>
    </article>
  );
}
