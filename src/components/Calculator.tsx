import { useState, useEffect } from "react";

interface CalculatorProps {
  open: boolean;
  onClose: () => void;
  onDone: (value: number) => void;
  initialValue?: string;
}

export function Calculator({ open, onClose, onDone, initialValue = "0" }: CalculatorProps) {
  const [expr, setExpr] = useState(initialValue);

  useEffect(() => {
    if (open) {
      setExpr(initialValue);
    }
  }, [open, initialValue]);

  if (!open) return null;

  const evaluate = (s: string): number => {
    try {
      if (!/^[0-9+\-*/.\s()]+$/.test(s)) return 0;
      // eslint-disable-next-line no-new-func
      const v = Function(`"use strict";return (${s})`)();
      return typeof v === "number" && isFinite(v) ? v : 0;
    } catch {
      return 0;
    }
  };

  const append = (ch: string) => {
    setExpr((prev) => {
      if (prev === "0" && /[0-9.]/.test(ch)) return ch;
      if (/[+\-*/]$/.test(prev) && /[+\-*/]/.test(ch)) return prev.slice(0, -1) + ch;
      return prev + ch;
    });
  };

  const backspace = () => setExpr((p) => (p.length <= 1 ? "0" : p.slice(0, -1)));
  const ac = () => setExpr("0");
  const done = () => {
    onDone(Math.round(evaluate(expr)));
    setExpr("0");
  };
  const cancel = () => {
    setExpr("0");
    onClose();
  };

  const btn = "h-16 rounded-xl text-xl font-medium text-white active:scale-95 transition flex items-center justify-center";

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={cancel}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full rounded-t-3xl p-4 pb-8"
        style={{ backgroundColor: "var(--calc-surface)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-right text-5xl font-light pr-2 pb-4 pt-2 text-foreground truncate">
          {expr}
        </div>
        <div className="grid grid-cols-4 gap-2">
          <button onClick={ac} className={btn} style={{ backgroundColor: "var(--calc-red)" }}>AC</button>
          <button onClick={backspace} className={btn} style={{ backgroundColor: "var(--calc-red)" }}>⌫</button>
          <button onClick={() => append("/")} className={btn} style={{ backgroundColor: "var(--calc-orange)" }}>÷</button>
          <button onClick={() => append("*")} className={btn} style={{ backgroundColor: "var(--calc-orange)" }}>×</button>

          <button onClick={() => append("7")} className={btn} style={{ backgroundColor: "var(--calc-key)" }}>7</button>
          <button onClick={() => append("8")} className={btn} style={{ backgroundColor: "var(--calc-key)" }}>8</button>
          <button onClick={() => append("9")} className={btn} style={{ backgroundColor: "var(--calc-key)" }}>9</button>
          <button onClick={() => append("-")} className={btn} style={{ backgroundColor: "var(--calc-orange)" }}>−</button>

          <button onClick={() => append("4")} className={btn} style={{ backgroundColor: "var(--calc-key)" }}>4</button>
          <button onClick={() => append("5")} className={btn} style={{ backgroundColor: "var(--calc-key)" }}>5</button>
          <button onClick={() => append("6")} className={btn} style={{ backgroundColor: "var(--calc-key)" }}>6</button>
          <button onClick={() => append("+")} className={btn} style={{ backgroundColor: "var(--calc-orange)" }}>+</button>

          <button onClick={() => append("1")} className={btn} style={{ backgroundColor: "var(--calc-key)" }}>1</button>
          <button onClick={() => append("2")} className={btn} style={{ backgroundColor: "var(--calc-key)" }}>2</button>
          <button onClick={() => append("3")} className={btn} style={{ backgroundColor: "var(--calc-key)" }}>3</button>
          <button onClick={done} className={btn} style={{ backgroundColor: "var(--calc-green)" }}>Done</button>

          <button onClick={() => append("0")} className={`${btn} col-span-2`} style={{ backgroundColor: "var(--calc-key)" }}>0</button>
          <button onClick={() => append(".")} className={btn} style={{ backgroundColor: "var(--calc-key)" }}>.</button>
          <button onClick={cancel} className={btn} style={{ backgroundColor: "var(--calc-gray)" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
