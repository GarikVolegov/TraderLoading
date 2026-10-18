import type { NewsDeepDive } from "./types.js";

/** Conservative output guard: numbers and surprise/consensus claims need source evidence. */
export function supportedAnalysisText(value: unknown, evidence: string): value is string {
  if (typeof value !== "string" || value.trim().length < 15 || value.length > 1800) return false;
  const figures = (text: string) => (text.match(/[+-]?\d+(?:[.,]\d+)?(?:\s*%|\s*bps)?/g) ?? []).map(n => n.toLowerCase().replace(/\s/g, "").replace(/,/g, ".").replace(/^\+/, ""));
  const supportedFigures = new Set(figures(evidence));
  if (figures(value).some(n => !supportedFigures.has(n))) return false;
  // A genuine policy-rate number cannot be relabeled as CPI/GDP/payroll data.
  // Link a figure to its nearest explicit series noun, when one is present.
  const subjects = [/\brate\b|interest rates?|tass[oi]/i, /\bcpi\b|consumer price index|inflation|inflazion/i,
    /payroll|employment|\bnfp\b|occupazion/i, /\bgdp\b|gross domestic product|\bpil\b/i];
  const subjectAt = (text:string,index:number) => {
    const prefix=text.slice(Math.max(0,index-100),index);
    let found:number|null=null,closest=-1;
    subjects.forEach((subject,id)=>{
      for(const match of prefix.matchAll(new RegExp(subject.source,"gi")))
        if(match.index>closest){closest=match.index;found=id;}
    });
    return found;
  };
  const numberPattern = /[+-]?\d+(?:[.,]\d+)?(?:\s*%|\s*bps)?/g;
  const numericEvidence = [...evidence.matchAll(numberPattern)];
  for(const match of value.matchAll(numberPattern)) {
    const subject=subjectAt(value,match.index);
    if(subject!==null && !numericEvidence.some(source=>figures(source[0])[0]===figures(match[0])[0] && subjectAt(evidence,source.index)===subject)) return false;
  }
  if (/consensus|consenso/i.test(value) && !/consensus|consenso/i.test(evidence)) return false;
  if (/surpris|sorpres|above\s+expectations|below\s+expectations|sopra\s+(?:le\s+)?attese|sotto\s+(?:le\s+)?attese/i.test(value) && !/surpris|unexpected|above\s+expectations|below\s+expectations|sorpres/i.test(evidence)) return false;
  // Qualitative actions need matching source vocabulary too. This is a guard,
  // not a claim of complete semantic verification.
  const actions = [
    [/\bcut(?:s|ting)?\b|tagli|abbass|senk|baiss|recort/i, /\bcut(?:s|ting)?\b|lower|reduc|tagli|abbass|senk|baiss|recort/i],
    [/\bhik(?:e|es|ing)\b|rialz|aument.{0,20}tass/i, /\bhik(?:e|es|ing)\b|rais|increas|rialz|aument/i],
    [/emergency|emergenza|urgenc|notfall/i, /emergency|emergenza|urgenc|notfall/i],
    [/promis|promess|pledge/i, /promis|pledge|commit|promess/i],
  ];
  if (actions.some(([claim, support])=>claim.test(value) && !support.test(evidence))) return false;
  if (/\b(?:held|kept|maintained|unchanged)\b|mantenut|invariat/i.test(value) &&
      !/\b(?:held|kept|maintained|unchanged)\b|mantenut|invariat/i.test(evidence)) return false;
  // A lower inflation forecast is not evidence of a completed interest-rate cut.
  if (/\bcut(?:s)?\b.{0,50}\brates?\b|\brates?\b.{0,40}\bcut\b|tagli.{0,40}tass/i.test(value) &&
      !/\b(?:cut|lowered|reduced)\b[^.!?]{0,100}\b(?:rate|range)\b|\b(?:rate|range)\b[^.!?]{0,100}\b(?:cut|lowered|reduced)\b|tagli.{0,40}tass/i.test(evidence)) return false;
  return true;
}

export function supportedDeepDive(value: unknown, evidence: string): NewsDeepDive | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Record<string, unknown>;
  if (!supportedAnalysisText(candidate.whatHappened, evidence) || !supportedAnalysisText(candidate.whyItMatters, evidence) || !supportedAnalysisText(candidate.possibleImpact, evidence)) return undefined;
  // The factual section cannot introduce an institution, asset or macro event
  // absent from the supplied document. This remains a conservative guard, not
  // a semantic verification certificate for the model's prose.
  const factTopics = [
    /\becb\b|banca centrale europea|european central bank/i,
    /bank of japan|banca del giappone|\bboj\b/i,
    /bank of england|banca d.inghilterra|\bboe\b/i,
    /recessio|recesi[oó]n|rezession/i,
    /\bgold\b|\bxau\b|\boro\b|\bgoud\b/i,
    /\bdollar\b|\bdollaro\b|\busd\b/i,
    /default|insolven|bankrupt|falliment/i,
  ];
  if (factTopics.some(topic=>topic.test(candidate.whatHappened as string) && !topic.test(evidence))) return undefined;
  // Effects are scenarios: unconditional promises of a future market move are
  // rejected rather than published beside a source-backed fact.
  if (!/\b(if|could|may|might|can|conditional|uncertain|se|potrebbe|potrebbero|pu[oò]|possono|incert|si|podr[ií]a|peut|pourrait|k[oö]nnte|falls|wenn)\b/i.test(candidate.possibleImpact)) return undefined;
  return { whatHappened: candidate.whatHappened, whyItMatters: candidate.whyItMatters, possibleImpact: candidate.possibleImpact };
}
