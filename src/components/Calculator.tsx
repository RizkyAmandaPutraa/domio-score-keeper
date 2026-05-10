import { useState } from "react";

interface CalculatorProps {
  open: boolean;
  onClose: () => void;
  onDone: (value: number) => void;
  accentColor: string;
}

export function Calculator({ open, onClose, onDone, accentColor }: CalculatorProps) {
  const [expr, setExpr] = useState("0");

  if (!open) return null;

  const evaluate = (s: string): number => {
    try {
      // sanitize
      if (!/^[0-9+\-*/.\s]+$/.test(s)) return 0;
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
      return prev + ch;
    });
  };

  const backspace = () => {
    setExpr((prev) => (prev.length <= 1 ? "0" : prev.slice(0, -1)));
  };

  const ac = () => setExpr("0");

  const done = () => {
    const val = Math.round(evaluate(expr));
    onDone(val);
    setExpr("0");
  };

  const cancel = () => {
    setExpr("0");
    onClose();
  };

  const Key = ({
    children,
    onClick,
    className = "",
  }: {
    children: React.ReactNode;
    onClick: () => void;
    className?: string;
  }) => (
    <button
      onClick={onClick}
      className={`h-14 rounded-xl text-xl font-medium active:scale-95 transition ${className}`}
    >
      {children}
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      onClick={cancel}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full rounded-t-3xl p-4 pb-6"
        style={{ backgroundColor: "var(--calc-surface)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-right text-4xl font-light pr-2 pb-4 pt-2 text-foreground truncate">
          {expr}
        </div>
        <div className="grid grid-cols-4 gap-2">
          <Key onClick={ac} className="text-white" style={{} as any}>
            <span className="block w-full h-full flex items-center justify-center rounded-xl" style={{ backgroundColor: "var(--calc-red)" }}>AC</span>
          </Key>
          <Key onClick={backspace}>
            <span className="block w-full h-full flex items-center justify-center rounded-xl text-white" style={{ backgroundColor: "var(--calc-red)" }}>⌫</span>
          </Key>
          <Key onClick={() => append("/")}>
            <span className="block w-full h-full flex items-center justify-center rounded-xl text-white" style={{ backgroundColor: "var(--calc-orange)" }}>÷</span>
          </Key>
          <Key onClick={() => append("*")}>
            <span className="block w-full h-full flex items-center justify-center rounded-xl text-white" style={{ backgroundColor: "var(--calc-orange)" }}>×</span>
          </Key>

          <Key onClick={() => append("7")} className="text-white" >
            <span className="block w-full h-full flex items-center justify-center rounded-xl" style={{ backgroundColor: "var(--calc-key)" }}>7</span>
          </Key>
          <Key onClick={() => append("8")}>
            <span className="block w-full h-full flex items-center justify-center rounded-xl text-white" style={{ backgroundColor: "var(--calc-key)" }}>8</span>
          </Key>
          <Key onClick={() => append("9")}>
            <span className="block w-full h-full flex items-center justify-center rounded-xl text-white" style={{ backgroundColor: "var(--calc-key)" }}>9</span>
          </Key>
          <Key onClick={() => append("-")}>
            <span className="block w-full h-full flex items-center justify-center rounded-xl text-white" style={{ backgroundColor: "var(--calc-orange)" }}>−</span>
          </Key>

          <Key onClick={() => append("4")}>
            <span className="block w-full h-full flex items-center justify-center rounded-xl text-white" style={{ backgroundColor: "var(--calc-key)" }}>4</span>
          </Key>
          <Key onClick={() => append("5")}>
            <span className="block w-full h-full flex items-center justify-center rounded-xl text-white" style={{ backgroundColor: "var(--calc-key)" }}>5</span>
          </Key>
          <Key onClick={() => append("6")}>
            <span className="block w-full h-full flex items-center justify-center rounded-xl text-white" style={{ backgroundColor: "var(--calc-key)" }}>6</span>
          </Key>
          <Key onClick={() => append("+")}>
            <span className="block w-full h-full flex items-center justify-center rounded-xl text-white" style={{ backgroundColor: "var(--calc-orange)" }}>+</span>
          </Key>

          <Key onClick={() => append("1")}>
            <span className="block w-full h-full flex items-center justify-center rounded-xl text-white" style={{ backgroundColor: "var(--calc-key)" }}>1</span>
          </Key>
          <Key onClick={() => append("2")}>
            <span className="block w-full h-full flex items-center justify-center rounded-xl text-white" style={{ backgroundColor: "var(--calc-key)" }}>2</span>
          </Key>
          <Key onClick={() => append("3")}>
            <span className="block w-full h-full flex items-center justify-center rounded-xl text-white" style={{ backgroundColor: "var(--calc-key)" }}>3</span>
          </Key>
          <Key onClick={done}>
            <span className="block w-full h-full flex items-center justify-center rounded-xl text-white" style={{ backgroundColor: "var(--calc-green)" }}>Done</span>
          </Key>

          <Key onClick={() => append("0")} className="col-span-2">
            <span className="block w-full h-full flex items-center justify-center rounded-xl text-white" style={{ backgroundColor: "var(--calc-key)" }}>0</span>
          </Key>
          <Key onClick={() => append(".")}>
            <span className="block w-full h-full flex items-center justify-center rounded-xl text-white" style={{ backgroundColor: "var(--calc-key)" }}>.</span>
          </Key>
          <Key onClick={cancel}>
            <span className="block w-full h-full flex items-center justify-center rounded-xl text-white" style={{ backgroundColor: "var(--calc-gray)" }}>Cancel</span>
          </Key>
        </div>
      </div>
    </div>
  );
}