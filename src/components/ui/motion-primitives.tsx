import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

type SpotlightStyle = CSSProperties & {
  "--spotlight-x"?: string;
  "--spotlight-y"?: string;
};

/** A restrained, dashboard-safe adaptation of React Bits' Spotlight Card pattern. */
export function SpotlightCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const [position, setPosition] = useState({ x: "50%", y: "50%" });

  const handlePointerMove = (event: MouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    setPosition({
      x: `${event.clientX - bounds.left}px`,
      y: `${event.clientY - bounds.top}px`,
    });
  };

  const style: SpotlightStyle = {
    "--spotlight-x": position.x,
    "--spotlight-y": position.y,
  };

  return (
    <div
      className={cn("spotlight-card", className)}
      style={style}
      onMouseMove={handlePointerMove}
    >
      {children}
    </div>
  );
}

/** Count-up motion inspired by React Bits, with reduced-motion support. */
export function CountUpValue({
  value,
  format = (next) => next.toLocaleString("en-IN"),
  duration = 750,
}: {
  value: number;
  format?: (value: number) => string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(value);
  const previous = useRef(value);

  useEffect(() => {
    const from = previous.current;
    previous.current = value;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(value);
      return;
    }

    let frame = 0;
    const startedAt = performance.now();
    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [duration, value]);

  return <>{format(display)}</>;
}

/** Small staggered reveal for operational lists, not a perpetual animation. */
export function AnimatedList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("animated-list", className)}>{children}</div>;
}
