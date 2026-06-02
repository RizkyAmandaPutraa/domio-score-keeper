PRD — Redesign Aplikasi “Domino Score”
1. Overview
Nama Produk

Domino Score — Modern Score Tracker

Tujuan Redesign

Membuat tampilan aplikasi score domino menjadi:

Lebih modern
Lebih mudah dibaca saat bermain
Lebih cepat digunakan dalam kondisi realtime
Lebih fokus ke data pemain & skor
Lebih nyaman di dark mode
2. Problem Statement

Tampilan lama memiliki beberapa masalah:

Masalah	Dampak
Angka terlalu tersebar	Sulit scanning cepat
Hierarki visual kurang jelas	User bingung fokus utama
Tidak ada grouping card modern	UI terasa jadul
Tombol action kecil	Sulit ditekan saat bermain
Riwayat kurang terstruktur	Sulit membaca ronde
Tidak ada emphasis winner/loser	Insight permainan kurang jelas
3. Goals
Primary Goals
Mempermudah pencatatan skor realtime
Mempercepat pembacaan total skor
Membuat UI lebih premium & modern
Secondary Goals
Responsive mobile-first
Mudah dipakai dalam kondisi gelap
Mengurangi salah input skor
4. Target User
Primary User

Pemain domino / tongkrongan / komunitas game kartu

User Behavior
Bermain cepat
Sering melihat total skor
Input skor berulang
Menggunakan HP sambil bermain
5. Design Direction
Visual Style

Modern Dark UI + Neon Accent

Mood
Clean
Competitive
Futuristic
Fast interaction
Inspiration
Mobile gaming dashboard
Esports scoreboard
Financial tracking UI
6. Information Architecture
Struktur Baru
HEADER
├── App Title
├── Player Management
├── Reset / Delete Action

PLAYER SUMMARY CARDS
├── Nama
├── Trophy Count
├── Profit/Loss
├── Total Score

GAME HISTORY TABLE
├── Round Number
├── Score per player
├── Color Indicator

BOTTOM QUICK ACTION
├── Add score button
├── Current total
7. UI Components
7.1 Header
Isi
Hamburger/Menu
App Title
Add Player
Delete
Reset
Design
Transparent dark navbar
Icon monochrome white/red
Sticky top navigation
Tujuan

Memberi akses cepat ke action utama.

7.2 Player Summary Card
Komponen
Player name
Edit icon
Trophy badge
Profit/Loss
Total score besar
Visual
Rounded card
Soft neon glow
Warna unik per player
Interaction

Tap card → buka detail player

7.3 Riwayat Permainan
Format

Table modern dengan:

Rounded container
Alternate spacing
Icon player header
Fitur
Highlight skor tertinggi ronde
Empty state "-"
Auto scroll
UX Improvement

User bisa scan hasil ronde lebih cepat.

7.4 Floating Quick Add Button
Design
Circular FAB besar
Warna sesuai player
Sticky bottom
Purpose

Mempercepat input score.

7.5 Color System
Warna Player
Player	Color
Ger	Blue
Ris	Red
Dap	Green
Pin	Yellow
Background
#050505
#0B1020
#121826
Accent Glow

Soft neon blur opacity rendah.

8. Typography
Font Recommendation
Inter
SF Pro Display
Poppins
Hierarchy
Element	Size	Weight
Total Score	48-56px	Bold
Player Name	24px	SemiBold
Table Score	20px	Medium
Label	14px	Regular
9. UX Improvements
Sebelum
Banyak ruang kosong
Data sulit dipahami cepat
Tidak ada visual hierarchy
Sesudah
Fokus ke total score
Action lebih cepat
Riwayat lebih rapi
Visual lebih engaging
10. Interaction Design
Animation
Card Hover / Tap
Scale 1.02
Glow increase
Add Score
Smooth number transition
Count-up animation
Round Added
Slide-down animation
11. Responsive Behavior
Mobile Priority

Layout utama:

4-column compact
Scroll vertical
Tablet
Expanded spacing
Side statistics panel
12. Accessibility
Improvements
High contrast
Large touch target
Color + icon indicator
Readable in low light
13. Suggested Tech Stack
Frontend
Next.js
TailwindCSS
Framer Motion
State
Zustand / Redux
Backend
Supabase
Charts (optional)
Recharts
14. Future Features
Phase 2
Match history
Save session
Multiplayer sync
Winner animation
Statistik pemain
Dark/Light toggle
Export PDF
15. Success Metrics
Metric	Target
Faster score input	-40% tap time
Readability	+60% usability
User satisfaction	High
Error input	Reduced
16. Design Principles
1. Focus on score

Angka harus jadi elemen paling dominan.

2. Fast interaction

Semua action maksimal 1 tap.

3. Visual clarity

User bisa scan data dalam <2 detik.

4. Consistency

Warna pemain konsisten di semua section.

17. Suggested Next Step

Tahapan berikut yang sangat disarankan:

Design System
Wireframe Low Fidelity
High Fidelity UI
Component Architecture
Frontend Implementation
Animation Polish
User Testing
18. Component Breakdown (React)
<App>
 ├── Header
 ├── PlayerSummaryGrid
 │    └── PlayerCard
 ├── MatchHistoryTable
 ├── FloatingActionBar
 └── BottomStats
19. UI Improvement Priority
Priority	Feature
High	Player cards
High	Quick add button
High	Table readability
Medium	Animation
Medium	Statistics
Low	Themes
20. Final Vision

Aplikasi ini harus terasa seperti:

“score tracker premium yang cepat, modern, dan nyaman dipakai saat bermain ramai-ramai.”