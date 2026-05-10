import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, RotateCcw, Trophy, UserPlus, UserMinus, Pencil } from "lucide-react";
import { Calculator } from "@/components/Calculator";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Domino Score Counter" },
      { name: "description", content: "Hitung skor domino dengan mudah, hingga 4 pemain. Data tersimpan otomatis." },
    ],
  }),
});

interface Player {
  id: string;
  name: string;
  scores: number[];
}

const STORAGE_KEY = "domino-score-state-v1";
const COLORS = [
  "var(--player-1)",
  "var(--player-2)",
  "var(--player-3)",
  "var(--player-4)",
];

function makePlayer(i: number): Player {
  return { id: crypto.randomUUID(), name: `Player ${i + 1}`, scores: [] };
}

function Index() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [calcFor, setCalcFor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Player[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPlayers(parsed);
          setLoaded(true);
          return;
        }
      }
    } catch {}
    setPlayers([makePlayer(0), makePlayer(1)]);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(players));
  }, [players, loaded]);

  const total = (p: Player) => p.scores.reduce((a, b) => a + b, 0);
  const maxTotal = Math.max(0, ...players.map(total));

  const addScore = (id: string, value: number) => {
    if (!value) return;
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, scores: [...p.scores, value] } : p)));
  };

  const renamePlayer = (id: string, name: string) => {
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  };

  const reset = () => {
    if (!confirm("Reset semua skor?")) return;
    setPlayers((prev) => prev.map((p) => ({ ...p, scores: [] })));
  };

  const addPlayer = () => {
    if (players.length >= 4) return;
    setPlayers((prev) => [...prev, makePlayer(prev.length)]);
  };

  const removePlayer = () => {
    if (players.length <= 1) return;
    setPlayers((prev) => prev.slice(0, -1));
  };

  if (!loaded) return null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <h1 className="text-lg font-semibold tracking-tight">Domino Score</h1>
        <div className="flex items-center gap-1">
          <button
            onClick={removePlayer}
            disabled={players.length <= 1}
            className="p-2 rounded-lg hover:bg-white/5 disabled:opacity-30"
            aria-label="Hapus pemain"
          >
            <UserMinus className="w-5 h-5" />
          </button>
          <button
            onClick={addPlayer}
            disabled={players.length >= 4}
            className="p-2 rounded-lg hover:bg-white/5 disabled:opacity-30"
            aria-label="Tambah pemain"
          >
            <UserPlus className="w-5 h-5" />
          </button>
          <button
            onClick={reset}
            className="p-2 rounded-lg hover:bg-white/5"
            aria-label="Reset"
          >
            <RotateCcw className="w-5 h-5 text-[var(--calc-red)]" />
          </button>
        </div>
      </header>

      {/* Players */}
      <main className={`flex-1 grid`} style={{ gridTemplateColumns: `repeat(${players.length}, minmax(0,1fr))` }}>
        {players.map((p, i) => {
          const color = COLORS[i];
          const t = total(p);
          const isLeader = t > 0 && t === maxTotal;
          return (
            <div
              key={p.id}
              className="flex flex-col items-center pt-6 pb-4 border-r last:border-r-0 border-white/5 relative"
            >
              {/* Name */}
              <div className="flex items-center gap-1 mb-2">
                {editingId === p.id ? (
                  <input
                    autoFocus
                    value={p.name}
                    onChange={(e) => renamePlayer(p.id, e.target.value)}
                    onBlur={() => setEditingId(null)}
                    onKeyDown={(e) => e.key === "Enter" && setEditingId(null)}
                    className="bg-transparent border-b border-white/20 text-center text-lg font-semibold w-24 outline-none"
                    style={{ color }}
                  />
                ) : (
                  <button
                    onClick={() => setEditingId(p.id)}
                    className="flex items-center gap-1 text-lg font-semibold"
                    style={{ color }}
                  >
                    {p.name}
                    <Pencil className="w-3 h-3 opacity-40" />
                  </button>
                )}
              </div>

              {/* Trophy badge */}
              <div
                className="flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium"
                style={{ backgroundColor: `color-mix(in oklab, ${color} 20%, transparent)`, color }}
              >
                <Trophy className="w-4 h-4" />
                {isLeader ? p.scores.length : 0}
              </div>

              {/* Scrollable score history */}
              <div className="flex-1 w-full overflow-y-auto mt-4 px-3 space-y-1 text-center">
                {p.scores.map((s, idx) => (
                  <div key={idx} className="text-sm opacity-60">
                    +{s}
                  </div>
                ))}
              </div>

              {/* Add button */}
              <button
                onClick={() => setCalcFor(p.id)}
                className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition mt-2"
                style={{ backgroundColor: color }}
                aria-label="Tambah skor"
              >
                <Plus className="w-7 h-7 text-white" />
              </button>

              {/* Total */}
              <div className="mt-3 text-4xl font-bold tabular-nums" style={{ color }}>
                {t}
              </div>
            </div>
          );
        })}
      </main>

      <Calculator
        open={calcFor !== null}
        onClose={() => setCalcFor(null)}
        onDone={(val) => {
          if (calcFor) addScore(calcFor, val);
          setCalcFor(null);
        }}
      />
    </div>
  );
}
