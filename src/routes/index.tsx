import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Plus, RotateCcw, Trophy, UserPlus, UserMinus, Pencil, Trash2 } from "lucide-react";
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
  wins: number;
  balance: number; // akumulasi saldo Rp (tidak direset)
}

const STORAGE_KEY = "domino-score-state-v2";
const COLORS = [
  "var(--player-1)",
  "var(--player-2)",
  "var(--player-3)",
  "var(--player-4)",
];

function makePlayer(i: number): Player {
  return { id: crypto.randomUUID(), name: `Player ${i + 1}`, scores: [], wins: 0, balance: 0 };
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

/**
 * Hitung tier setiap pemain berdasarkan total skor.
 * Tier 1 (pemenang) = total terkecil  → +Rp 15.000
 * Tier 2            = total ke-2 terkecil → -Rp 4.000
 * Tier 3            = total ke-3 terkecil → -Rp 5.000
 * Tier 4            = total terbesar      → -Rp 6.000
 */
function computeTiers(players: Player[]): Map<string, { tier: number; amount: number }> {
  const result = new Map<string, { tier: number; amount: number }>();
  const totals = players.map((p) => p.scores.reduce((a, b) => a + b, 0));
  const someoneReached51 = totals.some((t) => t >= 51);
  if (!someoneReached51) return result;

  // Hapus syarat allSameRounds agar sistem langsung menghitung
  // tier dan saldo begitu ada pemain yang mencapai >= 51.

  const ranked = players
    .map((p, i) => ({ id: p.id, total: totals[i] }))
    .sort((a, b) => a.total - b.total);

  // Cek apakah pemenang (poin paling kecil) poinnya <= 10
  const isSuperTier = ranked[0].total <= 10;

  if (isSuperTier) {
    ranked.forEach((entry, rank) => {
      if (rank === 0) {
        // Pemenang Super Tier
        result.set(entry.id, { tier: 0, amount: 24000 });
      } else {
        // Loser Super Tier (selalu -8.000)
        result.set(entry.id, { tier: rank, amount: -8000 });
      }
    });
  } else {
    const tierPayments = [15000, -4000, -5000, -6000];
    ranked.forEach((entry, rank) => {
      const tierIndex = Math.min(rank, players.length - 1);
      if (tierIndex >= players.length) return;
      const payment = tierIndex < tierPayments.length ? tierPayments[tierIndex] : -6000;
      result.set(entry.id, { tier: tierIndex + 1, amount: payment });
    });
  }

  return result;
}

/** Komponen riwayat skor per kolom — scroll otomatis ke bawah */
function ScoreHistory({ scores, color, showR, rIndex, onEdit, onDeleteLast }: { scores: number[]; color: string; showR?: boolean; rIndex?: number; onEdit?: (index: number) => void; onDeleteLast?: () => void }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [scores.length]);

  if (scores.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-xs opacity-20">—</span>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full overflow-y-auto px-1 py-1" style={{ minHeight: 0 }}>
      {scores.map((s, idx) => {
        const isLast = idx === scores.length - 1;
        let touchTimer: NodeJS.Timeout;
        let startX = 0;
        let currentX = 0;
        let isSwiping = false;

        const handleStart = (e: React.TouchEvent | React.MouseEvent) => {
          if ('touches' in e) {
            startX = e.touches[0].clientX;
          }
          isSwiping = false;
          touchTimer = setTimeout(() => {
            if (!isSwiping && onEdit) onEdit(idx);
          }, 500);
        };

        const handleMove = (e: React.TouchEvent) => {
          if (!isLast) return;
          currentX = e.touches[0].clientX;
          const diff = startX - currentX;
          if (diff > 10) {
            isSwiping = true;
            clearTimeout(touchTimer);
            const el = e.currentTarget as HTMLDivElement;
            el.style.transition = 'none';
            el.style.transform = `translateX(-${Math.min(diff, 80)}px)`;
            el.style.opacity = `${1 - Math.min(diff, 80) / 80}`;
          }
        };

        const handleEnd = (e: React.TouchEvent | React.MouseEvent) => {
          clearTimeout(touchTimer);
          if (isLast && isSwiping) {
            const diff = startX - currentX;
            const el = e.currentTarget as HTMLDivElement;
            el.style.transition = 'all 0.2s';
            if (diff > 50 && onDeleteLast) {
              onDeleteLast();
            } else {
              el.style.transform = `translateX(0)`;
              el.style.opacity = `1`;
            }
          }
          isSwiping = false;
        };

        return (
          <div
            key={idx}
            className="flex items-center justify-center py-1.5 cursor-pointer active:bg-white/5 rounded-lg mx-1 relative"
            onTouchStart={handleStart}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
            onMouseDown={handleStart}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onContextMenu={(e) => { e.preventDefault(); handleStart(e); }}
          >
            <div className="relative inline-flex items-center justify-center">
              <span
                className="text-3xl font-bold tracking-tight select-none"
                style={{ color, opacity: s === 0 ? 0 : 1 }}
              >
                {s === 0 ? "0" : s}
              </span>
              {showR && idx === rIndex && (
                <div
                  className="absolute -right-5 top-1/2 -translate-y-1/2 flex items-center justify-center bg-orange-500 rounded-full w-[18px] h-[18px]"
                  title="Skor Terkecil"
                >
                  <span className="text-white text-[10px] font-black leading-none">R</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} className="h-2" />
    </div>
  );
}

function Index() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [calcFor, setCalcFor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingScore, setEditingScore] = useState<{ playerId: string; index: number; score: number } | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showResetAllModal, setShowResetAllModal] = useState(false);
  const [currentBatch, setCurrentBatch] = useState<string[]>([]);
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Player[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Normalize: pastikan semua field baru ada nilainya
          const normalized = parsed.map((p) => ({
            ...p,
            wins: typeof p.wins === "number" && !isNaN(p.wins) ? p.wins : 0,
            balance: typeof p.balance === "number" && !isNaN(p.balance) ? p.balance : 0,
          }));
          setPlayers(normalized);
          setLoaded(true);
          return;
        }
      }
    } catch { }
    // Coba migrate dari key lama
    try {
      const oldRaw = localStorage.getItem("domino-score-state-v1");
      if (oldRaw) {
        const parsed = JSON.parse(oldRaw) as Player[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const migrated = parsed.map((p) => ({
            ...p,
            wins: typeof p.wins === "number" && !isNaN(p.wins) ? p.wins : 0,
            balance: 0,
          }));
          setPlayers(migrated);
          setLoaded(true);
          return;
        }
      }
    } catch { }
    setPlayers([makePlayer(0), makePlayer(1)]);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(players));
  }, [players, loaded]);

  const total = (p: Player) => p.scores.reduce((a, b) => a + b, 0);

  // Cek apakah game sudah selesai: ada pemain yang mencapai >= 51
  const totals = players.map(total);
  const gameFinished = totals.some((t) => t >= 51);

  const roundCounts = players.map((p) => p.scores.length);

  // Pemenang = pemain dengan skor terendah saat game selesai
  const minTotal = gameFinished ? Math.min(...totals) : Infinity;

  const tiers = computeTiers(players);

  // --- Blok & R Logo Logic ---
  let lastBlokRowIndex = -1;
  let lastBlokWinnerId: string | null = null;

  const maxScoresLength = Math.max(0, ...players.map(p => p.scores.length));

  for (let i = 0; i < maxScoresLength; i++) {
    const isComplete = players.every(p => p.scores.length > i);
    if (isComplete) {
      const rowScores = players.map(p => p.scores[i]);
      // Blok condition: Everyone has a score > 0
      const isBlok = rowScores.every(score => score > 0);
      if (isBlok) {
        lastBlokRowIndex = i;
        const minScore = Math.min(...rowScores);
        const winner = players.find(p => p.scores[i] === minScore);
        if (winner) {
          lastBlokWinnerId = winner.id;
        }
      }
    }
  }

  const addScore = (id: string, value: number) => {
    if (!value) return;
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, scores: [...p.scores, value] } : p)));
  };

  const handleDeleteLast = (playerId: string) => {
    setPlayers((prev) =>
      prev.map((p) => {
        if (p.id === playerId && p.scores.length > 0) {
          const newScores = [...p.scores];
          newScores.pop();
          return { ...p, scores: newScores };
        }
        return p;
      })
    );

    setCurrentBatch((prev) => {
      const newBatch = prev.filter((id) => id !== playerId);
      if (batchTimeoutRef.current) clearTimeout(batchTimeoutRef.current);
      if (newBatch.length > 0) {
        batchTimeoutRef.current = setTimeout(() => {
          const batchToFill = [...newBatch];
          setPlayers((prev2) =>
            prev2.map((p2) => {
              if (!batchToFill.includes(p2.id)) {
                return { ...p2, scores: [...p2.scores, 0] };
              }
              return p2;
            })
          );
          setCurrentBatch([]);
        }, 10000);
      }
      return newBatch;
    });
  };

  const renamePlayer = (id: string, name: string) => {
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  };

  const reset = () => {
    setShowResetModal(true);
  };

  const doReset = () => {
    setCurrentBatch([]);
    if (batchTimeoutRef.current) clearTimeout(batchTimeoutRef.current);

    setPlayers((prev) =>
      prev.map((p) => {
        const t = total(p);
        const currentWins = typeof p.wins === "number" && !isNaN(p.wins) ? p.wins : 0;
        const currentBalance = typeof p.balance === "number" && !isNaN(p.balance) ? p.balance : 0;
        const isWinner = gameFinished && t === minTotal;
        const tierInfo = tiers.get(p.id);
        const earnedAmount = tierInfo ? tierInfo.amount : 0;
        return {
          ...p,
          scores: [],
          wins: currentWins + (isWinner ? 1 : 0),
          balance: currentBalance + (gameFinished ? earnedAmount : 0),
        };
      })
    );
    setShowResetModal(false);
  };

  const resetAll = () => {
    setShowResetAllModal(true);
  };

  const doResetAll = () => {
    setCurrentBatch([]);
    if (batchTimeoutRef.current) clearTimeout(batchTimeoutRef.current);

    setPlayers((prev) =>
      prev.map((p) => ({
        ...p,
        scores: [],
        wins: 0,
        balance: 0,
      }))
    );
    setShowResetAllModal(false);
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
    <div className="h-dvh bg-background text-foreground flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
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
            onClick={resetAll}
            className="p-2 rounded-lg hover:bg-white/5"
            aria-label="Reset Semua (Skor, Piala, Saldo)"
          >
            <Trash2 className="w-5 h-5 text-[var(--calc-red)] opacity-70" />
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

      {/* Players — full height grid */}
      <main
        className="flex-1 grid overflow-hidden"
        style={{ gridTemplateColumns: `repeat(${players.length}, minmax(0,1fr))` }}
      >
        {players.map((p, i) => {
          const color = COLORS[i];
          const t = total(p);
          const tierInfo = tiers.get(p.id);
          const balance = typeof p.balance === "number" && !isNaN(p.balance) ? p.balance : 0;

          return (
            <div
              key={p.id}
              className="flex flex-col items-center pt-3 pb-3 border-r last:border-r-0 border-white/5 overflow-hidden"
            >
              {/* Name */}
              <div className="flex items-center gap-1 mb-1 shrink-0">
                {editingId === p.id ? (
                  <input
                    autoFocus
                    value={p.name}
                    onChange={(e) => renamePlayer(p.id, e.target.value)}
                    onBlur={() => setEditingId(null)}
                    onKeyDown={(e) => e.key === "Enter" && setEditingId(null)}
                    className="bg-transparent border-b border-white/20 text-center text-xl font-bold w-24 outline-none"
                    style={{ color }}
                  />
                ) : (
                  <button
                    onClick={() => setEditingId(p.id)}
                    className="flex items-center gap-1 text-xl font-bold leading-tight"
                    style={{ color }}
                  >
                    <span className="truncate max-w-[85px]">{p.name}</span>
                    <Pencil className="w-4 h-4 opacity-40 shrink-0" />
                  </button>
                )}
              </div>

              {/* Trophy badge */}
              <div
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-base font-bold shrink-0 mt-1"
                style={{ backgroundColor: `color-mix(in oklab, ${color} 20%, transparent)`, color }}
              >
                <Trophy className="w-5 h-5" />
                {p.wins}
              </div>

              {/* Saldo Rp — akumulasi, muncul selalu jika > 0 atau game sedang selesai */}
              <div className="mt-1 shrink-0 h-5 flex items-center justify-center w-full px-1 overflow-visible">
                {(balance !== 0 || tierInfo) && (
                  <span
                    className="text-[15px] font-bold tabular-nums whitespace-nowrap tracking-tight"
                    style={{
                      color: (balance + (tierInfo?.amount ?? 0)) >= 0
                        ? "var(--calc-green)"
                        : "var(--calc-red)",
                    }}
                  >
                    {(balance + (tierInfo?.amount ?? 0)) > 0 ? "+" : ""}
                    {formatRupiah(balance + (tierInfo?.amount ?? 0))}
                  </span>
                )}
              </div>

              {/* Riwayat skor — scrollable, mengisi ruang tengah */}
              <ScoreHistory 
                scores={p.scores} 
                color={color} 
                showR={p.id === lastBlokWinnerId}
                rIndex={lastBlokRowIndex}
                onEdit={(idx) => setEditingScore({ playerId: p.id, index: idx, score: p.scores[idx] })}
                onDeleteLast={() => handleDeleteLast(p.id)}
              />

              {/* Add button */}
              <button
                onClick={() => setCalcFor(p.id)}
                className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition shrink-0"
                style={{ backgroundColor: color }}
                aria-label="Tambah skor"
              >
                <Plus className="w-7 h-7 text-white" />
              </button>

              {/* Total skor */}
              <div
                className="mt-1 text-4xl font-bold tabular-nums shrink-0"
                style={{
                  color: t >= 51 ? "var(--calc-red)" : color,
                }}
              >
                {t}
              </div>
            </div>
          );
        })}
      </main>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowResetModal(false)} />
          <div className="relative bg-[var(--calc-surface)] rounded-2xl p-6 w-80 max-w-[90%] text-center shadow-2xl">
            <h2 className="text-lg font-semibold mb-2">Reset Skor</h2>
            <p className="text-sm text-foreground/70 mb-6">
              iyo reset ko ?
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-white/10 hover:bg-white/15 transition"
              >
                Batal
              </button>
              <button
                onClick={doReset}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white transition"
                style={{ backgroundColor: "var(--calc-red)" }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset All Confirmation Modal */}
      {showResetAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowResetAllModal(false)} />
          <div className="relative bg-[var(--calc-surface)] rounded-2xl p-6 w-80 max-w-[90%] text-center shadow-2xl border border-red-500/20">
            <h2 className="text-lg font-semibold mb-2 text-red-500">Reset sado </h2>
            <p className="text-sm text-foreground/70 mb-6">
              Reset sado ko?.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setShowResetAllModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-white/10 hover:bg-white/15 transition"
              >
                ndop
              </button>
              <button
                onClick={doResetAll}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white transition bg-red-600 hover:bg-red-700"
              >
                iyo
              </button>
            </div>
          </div>
        </div>
      )}

      <Calculator
        open={calcFor !== null}
        onClose={() => setCalcFor(null)}
        onDone={(val) => {
          if (calcFor) {
            if (!isNaN(val) && val > 0) {
              let newBatch = [...currentBatch];

              if (newBatch.includes(calcFor)) {
                // Same player inputted again, previous round must be over!
                // Auto fill the missing players from the PREVIOUS batch
                const batchToFill = [...newBatch];
                setPlayers(prev => prev.map(p => {
                  if (!batchToFill.includes(p.id)) {
                    return { ...p, scores: [...p.scores, 0] };
                  }
                  return p;
                }));
                newBatch = [];
              }

              // Add the new score
              addScore(calcFor, val);
              newBatch.push(calcFor);

              if (newBatch.length === 4) {
                // Blok round complete
                newBatch = [];
                if (batchTimeoutRef.current) clearTimeout(batchTimeoutRef.current);
              } else {
                // Start/reset timer
                if (batchTimeoutRef.current) clearTimeout(batchTimeoutRef.current);
                batchTimeoutRef.current = setTimeout(() => {
                  // Auto fill missing players for this batch
                  const batchToFill = [...newBatch];
                  setPlayers(prev => prev.map(p => {
                    if (!batchToFill.includes(p.id)) {
                      return { ...p, scores: [...p.scores, 0] };
                    }
                    return p;
                  }));
                  setCurrentBatch([]);
                }, 10000);
              }

              setCurrentBatch(newBatch);
            }
          }
          setCalcFor(null);
        }}
      />

      <Calculator
        open={editingScore !== null}
        onClose={() => setEditingScore(null)}
        initialValue={editingScore?.score.toString() || "0"}
        onDone={(val) => {
          if (editingScore) {
            if (!isNaN(val) && val >= 0) {
              setPlayers(prev => prev.map(p => {
                if (p.id === editingScore.playerId) {
                  const newScores = [...p.scores];
                  newScores[editingScore.index] = val;
                  return { ...p, scores: newScores };
                }
                return p;
              }));
            }
          }
          setEditingScore(null);
        }}
      />
    </div>
  );
}
