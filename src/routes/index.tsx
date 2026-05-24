import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Menu, Plus, RotateCcw, Trophy, UserPlus, UserMinus, Pencil, Trash2, User } from "lucide-react";
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

function formatCompactRupiah(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1000) return `${amount < 0 ? "-" : "+"}${Math.round(abs / 1000)}K`;
  if (amount === 0) return "0";
  return `${amount > 0 ? "+" : "-"}${abs}`;
}

/**
 * Hitung tier setiap pemain berdasarkan total skor.
 * Tier 1 (pemenang) = total terkecil  → +Rp 15.000
 * Tier 2            = total ke-2 terkecil → -Rp 4.000
 * Tier 3            = total ke-3 terkecil → -Rp 5.000
 * Tier 4            = total terbesar      → -Rp 6.000
 */
function computeTiers(players: Player[], tieOrder: string[] = []): Map<string, { tier: number; amount: number }> {
  const result = new Map<string, { tier: number; amount: number }>();
  const totals = players.map((p) => p.scores.reduce((a, b) => a + b, 0));
  const someoneReached51 = totals.some((t) => t >= 51);
  if (!someoneReached51) return result;

  const ranked = players
    .map((p, i) => ({ id: p.id, total: totals[i] }))
    .sort((a, b) => {
      if (a.total !== b.total) return a.total - b.total;
      const aIdx = tieOrder.indexOf(a.id);
      const bIdx = tieOrder.indexOf(b.id);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return 0;
    });

  const isSuperTier = ranked[0].total <= 10;

  if (isSuperTier) {
    ranked.forEach((entry, rank) => {
      if (rank === 0) {
        result.set(entry.id, { tier: 0, amount: 24000 });
      } else {
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

function Index() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [calcFor, setCalcFor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingScore, setEditingScore] = useState<{ playerId: string; index: number; score: number } | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showResetAllModal, setShowResetAllModal] = useState(false);
  const [currentBatch, setCurrentBatch] = useState<string[]>([]);
  const [showTieModal, setShowTieModal] = useState(false);
  const [tieOrder, setTieOrder] = useState<string[]>([]);
  const [selectedTiePlayerId, setSelectedTiePlayerId] = useState<string | null>(null);
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [hasDismissedTie, setHasDismissedTie] = useState(false);

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

  const tiers = computeTiers(players, tieOrder);

  // --- Deteksi tie yang belum diresolved di SEMUA posisi ---
  const allSameRounds = roundCounts.length > 0 && roundCounts.every((c) => c === roundCounts[0]);

  const unresolvedTie = (() => {
    if (!gameFinished || !allSameRounds) return null;

    const ranked = players
      .map((p, i) => ({ player: p, total: totals[i] }))
      .sort((a, b) => {
        if (a.total !== b.total) return a.total - b.total;
        const aIdx = tieOrder.indexOf(a.player.id);
        const bIdx = tieOrder.indexOf(b.player.id);
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        if (aIdx !== -1) return -1;
        if (bIdx !== -1) return 1;
        return 0;
      });

    const isSuperTier = ranked[0].total <= 10;
    const tierPayments = isSuperTier
      ? [24000, -8000, -8000, -8000].slice(0, players.length)
      : [15000, -4000, -5000, -6000].slice(0, players.length);

    let i = 0;
    while (i < ranked.length) {
      let j = i + 1;
      while (j < ranked.length && ranked[j].total === ranked[i].total) j++;

      if (j - i >= 2) {
        const groupPlayers = ranked.slice(i, j).map((r) => r.player);
        const groupAmounts = Array.from({ length: j - i }, (_, k) => {
          const idx = Math.min(i + k, tierPayments.length - 1);
          return tierPayments[idx];
        });

        // Skip jika semua amount sama (misal super tier loser semua -8k)
        if (!groupAmounts.every((a) => a === groupAmounts[0])) {
          const unresolvedPlayers = groupPlayers.filter((p) => !tieOrder.includes(p.id));
          if (unresolvedPlayers.length >= 2) {
            const resolvedCount = groupPlayers.length - unresolvedPlayers.length;
            const betterIdx = i + resolvedCount;
            const isWinnerTie = betterIdx === 0;
            const betterAmount = tierPayments[Math.min(betterIdx, tierPayments.length - 1)];
            return { players: unresolvedPlayers, isWinnerTie, betterAmount };
          }
        }
      }
      i = j;
    }
    return null;
  })();

  // Pemenang = pemain dengan skor terendah (dari tieOrder jika ada tie)
  const winnerId = (() => {
    if (!gameFinished) return null;
    const sorted = players
      .map((p, i) => ({ id: p.id, total: totals[i] }))
      .sort((a, b) => {
        if (a.total !== b.total) return a.total - b.total;
        const aIdx = tieOrder.indexOf(a.id);
        const bIdx = tieOrder.indexOf(b.id);
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        if (aIdx !== -1) return -1;
        if (bIdx !== -1) return 1;
        return 0;
      });
    return sorted[0]?.id ?? null;
  })();

  // --- Blok & R Logo Logic ---
  let lastBlokRowIndex = -1;
  let lastBlokWinnerId: string | null = null;

  const maxScoresLength = Math.max(0, ...players.map(p => p.scores.length));

  for (let i = 0; i < maxScoresLength; i++) {
    const isComplete = players.every(p => p.scores.length > i);
    if (isComplete) {
      const rowScores = players.map(p => p.scores[i]);
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

  // Auto-show tie modal ketika ada unresolved tie
  useEffect(() => {
    if (unresolvedTie && !showTieModal && !hasDismissedTie) {
      setSelectedTiePlayerId(null);
      setShowTieModal(true);
    }
  }, [players, tieOrder, hasDismissedTie, unresolvedTie, showTieModal]);

  // Reset dismissed state when there is no unresolved tie and rounds are complete
  useEffect(() => {
    if (allSameRounds && !unresolvedTie) {
      setHasDismissedTie(false);
    }
  }, [allSameRounds, unresolvedTie]);

  // Auto-reset ketika semua tie sudah resolved
  useEffect(() => {
    if (gameFinished && allSameRounds && !unresolvedTie && tieOrder.length > 0) {
      const finalTiers = computeTiers(players, tieOrder);
      setPlayers((prev) =>
        prev.map((p) => {
          const currentWins = typeof p.wins === "number" && !isNaN(p.wins) ? p.wins : 0;
          const currentBalance = typeof p.balance === "number" && !isNaN(p.balance) ? p.balance : 0;
          const isWinner = p.id === winnerId;
          const tierInfo = finalTiers.get(p.id);
          const earnedAmount = tierInfo ? tierInfo.amount : 0;
          return { ...p, scores: [], wins: currentWins + (isWinner ? 1 : 0), balance: currentBalance + earnedAmount };
        })
      );
      setTieOrder([]);
      setCurrentBatch([]);
      if (batchTimeoutRef.current) clearTimeout(batchTimeoutRef.current);
    }
  }, [tieOrder]);

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
    setHasDismissedTie(false);

    // Jika ada unresolved tie, tampilkan modal tie dulu
    if (unresolvedTie) {
      setShowResetModal(false);
      setSelectedTiePlayerId(null);
      setShowTieModal(true);
      return;
    }

    setPlayers((prev) =>
      prev.map((p) => {
        const t = total(p);
        const currentWins = typeof p.wins === "number" && !isNaN(p.wins) ? p.wins : 0;
        const currentBalance = typeof p.balance === "number" && !isNaN(p.balance) ? p.balance : 0;
        const isWinner = gameFinished && p.id === winnerId;
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
    setTieOrder([]);
  };

  const resetAll = () => {
    setShowResetAllModal(true);
  };

  const doResetAll = () => {
    setCurrentBatch([]);
    if (batchTimeoutRef.current) clearTimeout(batchTimeoutRef.current);
    setHasDismissedTie(false);

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

  const maxRounds = Math.max(0, ...players.map(p => p.scores.length));
  const historyBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    historyBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [maxRounds]);

  if (!loaded) return null;


  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: '#0A0E1A', color: '#E8ECF4' }}>
      {/* Floating Tie-Breaker Confirmation Banner */}
      {gameFinished && hasDismissedTie && (!allSameRounds || unresolvedTie !== null) && (
        <button
          onClick={() => {
            setHasDismissedTie(false);
            setShowTieModal(true);
          }}
          className="floating-tie-banner"
        >
          <Trophy className="w-4 h-4 text-yellow-400 shrink-0" />
          <span>Konfirmasi Pemenang</span>
        </button>
      )}

      {/* Header */}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="header-btn header-menu-btn" aria-label="Menu">
            <Menu style={{ width: 20, height: 20 }} />
          </button>
          <h1>Domino Score</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button onClick={removePlayer} disabled={players.length <= 1} className="header-btn" aria-label="Hapus pemain"><UserMinus style={{ width: 20, height: 20 }} /></button>
          <button onClick={addPlayer} disabled={players.length >= 4} className="header-btn" aria-label="Tambah pemain"><UserPlus style={{ width: 20, height: 20 }} /></button>
          <button onClick={resetAll} className="header-btn" aria-label="Reset Semua"><Trash2 style={{ width: 20, height: 20, color: 'var(--calc-red)', opacity: 0.7 }} /></button>
          <button onClick={reset} className="header-btn" aria-label="Reset"><RotateCcw style={{ width: 20, height: 20, color: 'var(--calc-red)' }} /></button>
        </div>
      </header>

      {/* Scrollable Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 0', minHeight: 0 }}>
        {/* Player Summary Cards */}
        <div className="player-summary-grid" style={{ gridTemplateColumns: `repeat(${players.length}, minmax(0, 1fr))` }}>
          {players.map((p, i) => {
            const color = COLORS[i];
            const t = total(p);
            const tierInfo = tiers.get(p.id);
            const bal = typeof p.balance === 'number' && !isNaN(p.balance) ? p.balance : 0;
            const projBal = bal + (tierInfo?.amount ?? 0);
            const isDanger = t >= 40 && t < 51;
            const someoneAbove30 = totals.some(tt => tt >= 30);
            const isSTC = t <= 10 && t > 0 && someoneAbove30;
            const balanceState = projBal > 0 ? 'profit' : projBal < 0 ? 'loss' : 'neutral';
            return (
              <div
                key={p.id}
                className={`player-card balance-${balanceState}`}
                style={{
                  '--card-accent-color': color,
                  '--card-glow-idle': `0 8px 24px rgba(0, 0, 0, 0.22), inset 0 0 18px color-mix(in srgb, ${color} 3%, transparent)`,
                  '--card-glow-active': `0 10px 26px rgba(0, 0, 0, 0.3), inset 0 0 20px color-mix(in srgb, ${color} 5%, transparent)`,
                } as React.CSSProperties}
              >
                <div className="card-top-row card-top-row-trophy-only">
                  <div className="card-trophy" style={{ backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)`, color }}>
                    <Trophy style={{ width: 13, height: 13 }} />{p.wins}
                  </div>
                </div>
                <div className={`card-total ${isDanger ? 'danger-pulse' : ''} ${isSTC ? 'super-glow' : ''}`} style={{ color: t >= 40 ? 'var(--calc-red)' : isSTC ? '#FFD700' : color }}>{t}</div>
                <div className="card-score-label">TOTAL SCORE</div>
                <div className="card-balance-row">
                  <div className="card-balance-pill">
                    {balanceState === 'loss' ? <ArrowDownRight style={{ width: 14, height: 14 }} /> : <ArrowUpRight style={{ width: 14, height: 14 }} />}
                    <span>{formatCompactRupiah(projBal)}</span>
                  </div>
                </div>
                <div className="card-balance-full">{formatRupiah(projBal)}</div>
              </div>
            );
          })}
        </div>

        {/* Game History Table */}
        <div className="history-container">
          <div className="history-header">
            <span className="history-title">Riwayat Permainan</span>
            <span className="history-subtitle">Total Poin</span>
          </div>
          {maxRounds > 0 && (
            <div className="history-scroll" style={{ maxHeight: 'calc(100dvh - 420px)' }}>
              <table className="history-table">
                <thead><tr>
                  <th></th>
                  {players.map((_, i) => (
                    <th key={i}><div className="player-icon-header" style={{ background: `color-mix(in srgb, ${COLORS[i]} 25%, transparent)` }}><User style={{ width: 14, height: 14, color: COLORS[i] }} /></div></th>
                  ))}
                </tr></thead>
                <tbody>
                  {Array.from({ length: maxRounds }, (_, ri) => {
                    const isLastRound = ri === maxRounds - 1;
                    return (
                      <tr key={ri} className={isLastRound ? 'row-enter' : ''}>
                        <td>{ri + 1}</td>
                        {players.map((p, pi) => {
                          if (ri >= p.scores.length) return <td key={p.id}></td>;
                          const s = p.scores[ri];
                          const isPlayerLast = ri === p.scores.length - 1;
                          const showR = p.id === lastBlokWinnerId && ri === lastBlokRowIndex;
                          let touchTimer: ReturnType<typeof setTimeout>;
                          let startX = 0, currentX = 0, isSwiping = false;
                          const onStart = (e: React.TouchEvent | React.MouseEvent) => {
                            if ('touches' in e) startX = e.touches[0].clientX;
                            isSwiping = false;
                            touchTimer = setTimeout(() => { if (!isSwiping) setEditingScore({ playerId: p.id, index: ri, score: s }); }, 500);
                          };
                          const onMove = (e: React.TouchEvent) => {
                            if (!isPlayerLast) return;
                            currentX = e.touches[0].clientX;
                            const d = startX - currentX;
                            if (d > 10) { isSwiping = true; clearTimeout(touchTimer); const el = e.currentTarget as HTMLElement; el.style.transition = 'none'; el.style.transform = `translateX(-${Math.min(d, 80)}px)`; el.style.opacity = `${1 - Math.min(d, 80) / 80}`; }
                          };
                          const onEnd = (e: React.TouchEvent | React.MouseEvent) => {
                            clearTimeout(touchTimer);
                            if (isPlayerLast && isSwiping) { const d = startX - currentX; const el = e.currentTarget as HTMLElement; el.style.transition = 'all 0.2s'; if (d > 50) { handleDeleteLast(p.id); } else { el.style.transform = 'translateX(0)'; el.style.opacity = '1'; } }
                            isSwiping = false;
                          };
                          return (
                            <td key={p.id} className="score-cell" onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd} onMouseDown={onStart} onMouseUp={onEnd} onMouseLeave={onEnd} onContextMenu={e => { e.preventDefault(); onStart(e); }}>
                              <span style={{ color: COLORS[pi] }}>{s === 0 ? <span className="score-dash">-</span> : s}</span>
                              {showR && <span className="r-badge">R</span>}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div ref={historyBottomRef} style={{ height: 4 }} />
            </div>
          )}
          {maxRounds === 0 && (
            <div style={{ padding: '32px 0', textAlign: 'center', opacity: 0.2, fontSize: 14 }}>Belum ada riwayat</div>
          )}
        </div>
      </div>

      {/* Bottom Quick Action Bar */}
      <div className="quick-action-bar">
        {players.map((p, i) => {
          const t = total(p);
          const color = COLORS[i];
          const isDanger = t >= 40 && t < 51;
          const someoneAbove30 = totals.some(tt => tt >= 30);
          const isSTC = t <= 10 && t > 0 && someoneAbove30;
          return (
            <div key={p.id} className="action-item">
              <button className="fab-btn" onClick={() => setCalcFor(p.id)} style={{ backgroundColor: color }} aria-label={`Tambah skor ${p.name}`}>
                <Plus style={{ width: 24, height: 24, color: '#fff' }} />
              </button>
              {editingId === p.id ? (
                <input
                  autoFocus
                  value={p.name}
                  onChange={e => renamePlayer(p.id, e.target.value)}
                  onBlur={() => setEditingId(null)}
                  onKeyDown={e => e.key === 'Enter' && setEditingId(null)}
                  className="action-name-input"
                  style={{ color, borderColor: `color-mix(in srgb, ${color} 45%, transparent)` }}
                />
              ) : (
                <button onClick={() => setEditingId(p.id)} className="action-name-button" style={{ color }}>
                  <span className="action-name">{p.name.length > 5 ? p.name.substring(0, 5) : p.name}</span>
                  <Pencil style={{ width: 10, height: 10, opacity: 0.45 }} />
                </button>
              )}
              <span className={`action-total ${isDanger ? 'danger-pulse' : ''} ${isSTC ? 'super-glow' : ''}`} style={{ color: t >= 40 ? 'var(--calc-red)' : isSTC ? '#FFD700' : color }}>{t}</span>
            </div>
          );
        })}
      </div>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 modal-overlay" onClick={() => setShowResetModal(false)} />
          <div className="relative bg-[var(--calc-surface)] rounded-2xl p-6 w-80 max-w-[90%] text-center shadow-2xl modal-content">
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

      {/* Tie-Breaker Modal */}
      {showTieModal && unresolvedTie && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm modal-overlay" onClick={() => { setShowTieModal(false); setTieOrder([]); setHasDismissedTie(true); }} />
          <div className="relative bg-[var(--calc-surface)] rounded-2xl p-6 w-80 max-w-[90%] text-center shadow-2xl border border-yellow-500/30 modal-content">
            {/* Trophy icon */}
            <div className="flex justify-center mb-3">
              <div className="w-14 h-14 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <Trophy className="w-7 h-7 text-yellow-400" />
              </div>
            </div>

            <h2 className="text-lg font-semibold mb-1">Samo skor ge</h2>
            <p className="text-sm text-foreground/60 mb-5">
              {unresolvedTie.isWinnerTie
                ? "Siapo menang?"
                : `Siapo yang kalah ${formatRupiah(Math.abs(unresolvedTie.betterAmount))}?`}
            </p>

            {/* Player buttons */}
            <div className="flex flex-col gap-3 mb-4">
              {unresolvedTie.players.map((tp) => {
                const playerIndex = players.findIndex((p) => p.id === tp.id);
                const color = COLORS[playerIndex] || "var(--foreground)";
                const isSelected = selectedTiePlayerId === tp.id;

                return (
                  <button
                    key={tp.id}
                    onClick={() => setSelectedTiePlayerId(tp.id)}
                    className="relative flex items-center justify-center gap-3 px-4 py-3 rounded-xl text-base font-bold transition-all duration-200"
                    style={{
                      backgroundColor: isSelected
                        ? `color-mix(in oklab, ${color} 35%, transparent)`
                        : `color-mix(in oklab, ${color} 12%, transparent)`,
                      color,
                      border: isSelected ? `2px solid ${color}` : '2px solid transparent',
                      transform: isSelected ? 'scale(1.03)' : 'scale(1)',
                      boxShadow: isSelected ? `0 0 20px color-mix(in oklab, ${color} 25%, transparent)` : 'none',
                    }}
                  >
                    {isSelected && (
                      <Trophy className="w-5 h-5 shrink-0" />
                    )}
                    <span>{tp.name}</span>
                    <span className="text-sm font-normal opacity-60">({total(tp)} pts)</span>
                  </button>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex justify-center gap-3">
              <button
                onClick={() => {
                  setShowTieModal(false);
                  setTieOrder([]);
                  setSelectedTiePlayerId(null);
                  setHasDismissedTie(true);
                }}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-white/10 hover:bg-white/15 transition"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  if (selectedTiePlayerId) {
                    // Tambahkan player yang dipilih ke tieOrder
                    setTieOrder((prev) => [...prev, selectedTiePlayerId]);
                    setSelectedTiePlayerId(null);
                    setShowTieModal(false);
                  }
                }}
                disabled={!selectedTiePlayerId}
                className="px-4 py-2 rounded-xl text-sm font-medium text-black transition disabled:opacity-30"
                style={{ backgroundColor: selectedTiePlayerId ? 'var(--calc-orange)' : 'var(--calc-gray)' }}
              >
                Konfirmasi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset All Confirmation Modal */}
      {showResetAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 modal-overlay" onClick={() => setShowResetAllModal(false)} />
          <div className="relative bg-[var(--calc-surface)] rounded-2xl p-6 w-80 max-w-[90%] text-center shadow-2xl border border-red-500/20 modal-content">
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
