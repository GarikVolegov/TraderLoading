import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { TrendingUp, BarChart2, Shield, Zap, TerminalSquare } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const features = [
  {
    icon: TrendingUp,
    title: "Live Market Intelligence",
    desc: "Real-time news, macro analysis, and sentiment tracking across all major pairs.",
  },
  {
    icon: BarChart2,
    title: "Advanced Trading Journal",
    desc: "Log trades, track performance, and analyse patterns with detailed analytics.",
  },
  {
    icon: Shield,
    title: "Risk Management Tools",
    desc: "Lot calculator, session clock, and economic calendar — all in one place.",
  },
  {
    icon: Zap,
    title: "Gamified Progress",
    desc: "Earn XP, level up, and stay accountable with daily missions and streaks.",
  },
];

// Mantieni allineato con il JSON-LD FAQPage in index.html: Google richiede che
// le risposte dello schema siano visibili in pagina.
export const FAQ_ITEMS = [
  {
    question: "Is TraderLoading free?",
    answer:
      "Yes. You can create an account and use the trading journal, macro news feed, risk tools and discipline routines for free — no credit card required.",
  },
  {
    question: "How does the automatic trade sync work?",
    answer:
      "TraderLoading connects to your MT4 or MT5 account through FX Blue Account Sync in read-only mode. Every closed trade is imported automatically with entry, exit, stop loss, take profit, P&L, commissions and swap — no manual data entry.",
  },
  {
    question: "Is my trading account safe?",
    answer:
      "Yes. The connection is read-only by design: you only ever use the investor (read-only) password, never the master password. TraderLoading can never place orders or modify your account.",
  },
  {
    question: "What makes TraderLoading different from other trading journals?",
    answer:
      "It combines tools that usually live in separate apps: an auto-synced journal with R-multiples and chart snapshots, real-time macro news with per-asset impact analysis, an account equity curve anchored to your real balance, and a psychology layer — emotional check-ins, mood-vs-performance insights and guided morning/evening routines.",
  },
  {
    question: "Do I need to install anything?",
    answer:
      "No. TraderLoading runs in the browser on desktop and mobile, and can be installed as a PWA for an app-like experience. Nothing to download on your trading machine.",
  },
] as const;

export default function LandingPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] opacity-60 translate-x-1/3 -translate-y-1/3" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[100px] opacity-50 -translate-x-1/3 translate-y-1/3" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
      </div>

      {/* ─── Header ─────────────────────────────────────────────────── */}
      <header className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-5 border-b border-white/5 backdrop-blur-md bg-background/50">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3 min-w-0"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
             <TerminalSquare className="w-5 h-5 text-primary" />
          </div>
          <span className="text-lg sm:text-xl font-bold tracking-tight whitespace-nowrap font-mono">
            TraderLoading
          </span>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-4 shrink-0"
        >
          <button
            onClick={() => setLocation("/sign-in")}
            className="hidden sm:block text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-4 py-2"
          >
            Sign In
          </button>
          <button
            onClick={() => setLocation("/sign-up")}
            className="text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors px-6 py-2.5 rounded-lg whitespace-nowrap shadow-[0_0_20px_rgba(0,204,102,0.2)]"
          >
            Get Started
          </button>
        </motion.div>
      </header>

      {/* ─── Hero ────────────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-20 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary text-xs font-semibold px-4 py-2 rounded-full mb-8"
        >
          <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          Professional Trading Dashboard
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1] max-w-4xl mb-6 font-mono"
        >
          Trade Smarter,{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-300">
            Not Harder
          </span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-lg sm:text-xl text-muted-foreground max-w-2xl mb-12 leading-relaxed"
        >
          Your all-in-one trading companion. Journal your trades, track macro news, manage risk, and level up your discipline every single day.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"
        >
          <button
            onClick={() => setLocation("/sign-up")}
            className="w-full sm:w-auto text-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all px-10 py-4 rounded-xl shadow-[0_0_30px_rgba(0,204,102,0.3)] hover:shadow-[0_0_40px_rgba(0,204,102,0.5)] transform hover:-translate-y-1"
          >
            Start for Free
          </button>
          <button
            onClick={() => setLocation("/sign-in")}
            className="w-full sm:w-auto text-lg font-medium border border-border bg-card/50 hover:bg-card hover:border-primary/40 text-foreground transition-all px-10 py-4 rounded-xl backdrop-blur-sm"
          >
            I already have an account
          </button>
        </motion.div>
      </main>

      {/* ─── Feature cards ───────────────────────────────────────────── */}
      <section className="relative z-10 px-4 sm:px-6 pb-24">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map(({ icon: Icon, title, desc }, idx) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 * idx }}
              className="bg-card/40 backdrop-blur-sm border border-border/50 rounded-3xl p-8 text-left hover:border-primary/30 transition-all hover:bg-card/60 group"
            >
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-bold text-foreground text-xl mb-3">{title}</h3>
              <p className="text-muted-foreground leading-relaxed text-base">{desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── FAQ ─────────────────────────────────────────────────────── */}
      <section className="relative z-10 px-4 sm:px-6 pb-24">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-center mb-10 font-mono">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {FAQ_ITEMS.map(({ question, answer }, idx) => (
              <motion.details
                key={question}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.05 * idx }}
                className="group rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm px-6 py-4 open:border-primary/30 open:bg-card/60 transition-colors"
              >
                <summary className="cursor-pointer list-none text-left font-bold text-foreground text-lg flex items-center justify-between gap-3">
                  {question}
                  <span className="shrink-0 text-primary transition-transform group-open:rotate-45 text-xl leading-none">+</span>
                </summary>
                <p className="mt-3 text-muted-foreground leading-relaxed text-base">{answer}</p>
              </motion.details>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/5 py-8 text-center text-sm text-muted-foreground bg-background/50 backdrop-blur-md">
        <div className="flex items-center justify-center gap-2 mb-2">
           <TerminalSquare className="w-4 h-4 opacity-50" />
           <span className="font-mono opacity-50">TraderLoading</span>
        </div>
        © {new Date().getFullYear()} TraderLoading. All rights reserved.
        <div className="mb-3 flex flex-wrap items-center justify-center gap-4">
          <Link href="/privacy" className="hover:text-foreground">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Termini
          </Link>
          <a
            href="mailto:assistenza@traderloading.com"
            className="hover:text-foreground"
          >
            Supporto
          </a>
        </div>
      </footer>
    </div>
  );
}
