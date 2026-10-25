"use client";

import React, { useState, useMemo } from "react";
import {
  FileText,
  Building2,
  Layers,
  Hash,
  Factory,
  Printer,
  Activity,
  AlertTriangle,
  Calendar,
  Boxes,
  Palette,
  Sparkles,
  Paperclip,
  DollarSign,
  Info,
  ArrowRight,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface EntityField {
  key: string;
  value: string;
}

export interface EntityCardSegment {
  type: "entity_card";
  title: string;
  docNo?: string;
  fields: EntityField[];
}

export interface TableSegment {
  type: "table";
  headers: string[];
  rows: string[][];
}

export interface CodeBlockSegment {
  type: "code_block";
  language: string;
  code: string;
}

export interface MarkdownSegment {
  type: "markdown";
  content: string;
}

export type MessageSegment =
  | EntityCardSegment
  | TableSegment
  | CodeBlockSegment
  | MarkdownSegment;

export interface CopilotMessageRendererProps {
  content: string;
  role?: "user" | "assistant" | "system";
  onOpenDocument?: (docNo: string, title?: string) => void;
  className?: string;
}

// ─── HELPER: EXTRACT DOC NUMBER ──────────────────────────────────────────────

const DOC_REGEX = /\b(WO[A-Z0-9]*-[\w\d-]+|SPEC-[\w\d-]+|RCV-[\w\d-]+|SHP-[\w\d-]+|ACT-[\w\d-]+|ORD-[\w\d-]+|INV-[\w\d-]+)\b/i;

function extractDocNo(text: string): string | undefined {
  const match = text.match(DOC_REGEX);
  return match ? match[1].toUpperCase() : undefined;
}

// ─── HELPER: FIELD ICON RESOLVER ─────────────────────────────────────────────

function getFieldIcon(key: string) {
  const lower = key.toLowerCase();
  if (lower.includes("hujjat") || lower.includes("doc") || lower.includes("№") || lower.includes("номер")) {
    return FileText;
  }
  if (lower.includes("mijoz") || lower.includes("klient") || lower.includes("клиент") || lower.includes("customer")) {
    return Building2;
  }
  if (lower.includes("mahsulot") || lower.includes("produkt") || lower.includes("продукт") || lower.includes("product") || lower.includes("nomi")) {
    return Layers;
  }
  if (lower.includes("tiraj") || lower.includes("miqdor") || lower.includes("тираж") || lower.includes("quantity") || lower.includes("qty") || lower.includes("soni")) {
    return Hash;
  }
  if (lower.includes("bo'lim") || lower.includes("sex") || lower.includes("цех") || lower.includes("dept") || lower.includes("department")) {
    return Factory;
  }
  if (lower.includes("uskuna") || lower.includes("dastgoh") || lower.includes("stanok") || lower.includes("станок") || lower.includes("machine") || lower.includes("press")) {
    return Printer;
  }
  if (lower.includes("bosqich") || lower.includes("holat") || lower.includes("status") || lower.includes("stage") || lower.includes("фаза")) {
    return Activity;
  }
  if (lower.includes("ustuvorlik") || lower.includes("priority") || lower.includes("приоритет")) {
    return AlertTriangle;
  }
  if (lower.includes("dedlayn") || lower.includes("muddat") || lower.includes("срок") || lower.includes("deadline") || lower.includes("sana") || lower.includes("date")) {
    return Calendar;
  }
  if (lower.includes("xomashyo") || lower.includes("material") || lower.includes("qog'oz") || lower.includes("karton") || lower.includes("сырье") || lower.includes("бумага") || lower.includes("stock") || lower.includes("ombor")) {
    return Boxes;
  }
  if (lower.includes("rang") || lower.includes("color") || lower.includes("pantone") || lower.includes("cmyk") || lower.includes("цвет")) {
    return Palette;
  }
  if (lower.includes("laminat") || lower.includes("lak") || lower.includes("qoplama") || lower.includes("покрытие")) {
    return Sparkles;
  }
  if (lower.includes("fayl") || lower.includes("biriktirilgan") || lower.includes("file") || lower.includes("attachment") || lower.includes("hujjatlar")) {
    return Paperclip;
  }
  if (lower.includes("narx") || lower.includes("summa") || lower.includes("qiymat") || lower.includes("qarz") || lower.includes("price") || lower.includes("cost") || lower.includes("debit") || lower.includes("kredit")) {
    return DollarSign;
  }
  return Info;
}

// ─── PARSER: CONTENT TO STRUCTURED SEGMENTS ──────────────────────────────────

export function parseMessageSegments(content: string): MessageSegment[] {
  if (!content || !content.trim()) return [];

  const rawLines = content.split("\n");
  const segments: MessageSegment[] = [];

  let i = 0;
  let markdownBuffer: string[] = [];

  const flushMarkdown = () => {
    if (markdownBuffer.length > 0) {
      const text = markdownBuffer.join("\n").trim();
      if (text) {
        segments.push({ type: "markdown", content: text });
      }
      markdownBuffer = [];
    }
  };

  while (i < rawLines.length) {
    const line = rawLines[i];
    const trimmed = line.trim();

    // 1. Code Block detection (```lang ... ```)
    if (trimmed.startsWith("```")) {
      flushMarkdown();
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < rawLines.length && !rawLines[i].trim().startsWith("```")) {
        codeLines.push(rawLines[i]);
        i++;
      }
      if (i < rawLines.length) i++; // skip closing ```
      segments.push({
        type: "code_block",
        language: lang,
        code: codeLines.join("\n"),
      });
      continue;
    }

    // 2. Markdown Table detection (| col1 | col2 |)
    if (trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.includes("|")) {
      const tableLines: string[] = [];
      while (i < rawLines.length && rawLines[i].trim().startsWith("|") && rawLines[i].trim().endsWith("|")) {
        tableLines.push(rawLines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        flushMarkdown();
        const parseRow = (r: string) =>
          r
            .split("|")
            .slice(1, -1)
            .map((c) => c.trim());

        const headers = parseRow(tableLines[0]);
        const dataLines = tableLines.slice(1).filter((l) => !l.replace(/[|\-\s:]/g, "").length === false && !/^[\s|:-]+$/.test(l));
        const rows = dataLines.map(parseRow);

        segments.push({
          type: "table",
          headers,
          rows,
        });
        continue;
      } else {
        // Not a full table, append to markdown buffer
        markdownBuffer.push(...tableLines);
        continue;
      }
    }

    // 3. Entity Card detection:
    // Look ahead for a block of key-value items (e.g. "• **Hujjat raqami**: WOCUT-26-0359" or "- Key: Value")
    // It may be preceded by a title line like "**WOCUT-26-0359 buyurtma kartochkasi ma'lumotlari:**"
    const isPotentialTitle =
      (trimmed.startsWith("**") && (trimmed.endsWith("**") || trimmed.endsWith(":**") || trimmed.endsWith(":"))) ||
      (trimmed.startsWith("###") || trimmed.startsWith("##")) ||
      (trimmed.endsWith(":") && trimmed.length < 80);

    const checkKvLine = (l: string) => {
      const t = l.trim();
      // Matches:
      // • **Key**: Value
      // - **Key**: Value
      // * **Key**: Value
      // **Key**: Value
      // • Key: Value
      const kvMatch = t.match(/^(?:[•\-\*]\s*)?(?:\*\*(.*?)\*\*|([A-Za-z0-9_'\s\/\(\)-]+))\s*:\s*(.*)$/);
      if (!kvMatch) return null;
      const rawKey = (kvMatch[1] || kvMatch[2] || "").trim().replace(/\*\*/g, "");
      const rawVal = (kvMatch[3] || "").trim();
      if (!rawKey || !rawVal) return null;
      // Filter out markdown links or URLs that might accidentally look like KV
      if (rawKey.startsWith("http") || rawKey.length > 50) return null;
      return { key: rawKey, value: rawVal };
    };

    let titleText = "";
    let kvStartIndex = i;

    if (isPotentialTitle) {
      titleText = trimmed
        .replace(/^#+\s*/, "")
        .replace(/^\*\*/, "")
        .replace(/\*\*[:\s]*$/, "")
        .replace(/[:\s]*$/, "")
        .trim();

      // Check next non-empty line
      let nextIdx = i + 1;
      while (nextIdx < rawLines.length && !rawLines[nextIdx].trim()) {
        nextIdx++;
      }
      if (nextIdx < rawLines.length && checkKvLine(rawLines[nextIdx])) {
        kvStartIndex = nextIdx;
      } else {
        // Not followed by key-values, treat as normal markdown
        markdownBuffer.push(line);
        i++;
        continue;
      }
    }

    // Now gather all consecutive key-value lines
    const cardFields: EntityField[] = [];
    let curIdx = isPotentialTitle ? kvStartIndex : i;

    while (curIdx < rawLines.length) {
      const curLine = rawLines[curIdx];
      const curTrimmed = curLine.trim();

      if (!curTrimmed) {
        // Allow a single blank line within fields if followed immediately by another KV
        if (curIdx + 1 < rawLines.length && checkKvLine(rawLines[curIdx + 1])) {
          curIdx++;
          continue;
        } else {
          break;
        }
      }

      const kv = checkKvLine(curTrimmed);
      if (kv) {
        cardFields.push(kv);
        curIdx++;
      } else {
        break;
      }
    }

    // If we gathered >= 3 key-value lines, this is definitely an Entity Card!
    if (cardFields.length >= 3) {
      flushMarkdown();

      // Determine doc number from title or from specific fields
      let foundDocNo = extractDocNo(titleText);
      if (!foundDocNo) {
        const docField = cardFields.find(
          (f) =>
            f.key.toLowerCase().includes("hujjat") ||
            f.key.toLowerCase().includes("doc") ||
            f.key.toLowerCase().includes("№") ||
            f.key.toLowerCase().includes("номер")
        );
        if (docField) {
          foundDocNo = extractDocNo(docField.value);
        }
      }
      if (!foundDocNo) {
        for (const f of cardFields) {
          const match = extractDocNo(f.value);
          if (match) {
            foundDocNo = match;
            break;
          }
        }
      }

      segments.push({
        type: "entity_card",
        title: titleText || foundDocNo || "Tafsilotlar kartochkasi",
        docNo: foundDocNo,
        fields: cardFields,
      });

      i = curIdx;
      continue;
    }

    // Otherwise, normal line
    markdownBuffer.push(line);
    i++;
  }

  flushMarkdown();
  return segments;
}

// ─── FIELD VALUE FORMATTER COMPONENT ─────────────────────────────────────────

function FieldValueRenderer({ fieldKey, value }: { fieldKey: string; value: string }) {
  const lowerKey = fieldKey.toLowerCase();
  const lowerVal = value.toLowerCase();

  // 1. Priority / Ustuvorlik
  if (lowerKey.includes("ustuvorlik") || lowerKey.includes("priority") || lowerKey.includes("приоритет")) {
    if (lowerVal.includes("urgent") || lowerVal.includes("shoshilinch") || lowerVal.includes("сроч")) {
      return (
        <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-semibold border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/10">
          Shoshilinch
        </Badge>
      );
    }
    if (lowerVal.includes("high") || lowerVal.includes("yuqori") || lowerVal.includes("высок")) {
      return (
        <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-semibold border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10">
          Yuqori
        </Badge>
      );
    }
    if (lowerVal.includes("normal") || lowerVal.includes("oddiy") || lowerVal.includes("норм")) {
      return (
        <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-medium border-border text-muted-foreground bg-muted/30">
          Oddiy
        </Badge>
      );
    }
    if (lowerVal.includes("low") || lowerVal.includes("past") || lowerVal.includes("низк")) {
      return (
        <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal border-border text-muted-foreground/70 bg-muted/20">
          Past
        </Badge>
      );
    }
    return <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-medium">{value}</Badge>;
  }

  // 2. Status / Stage / Bosqich / Holat
  if (
    lowerKey.includes("holat") ||
    lowerKey.includes("bosqich") ||
    lowerKey.includes("status") ||
    lowerKey.includes("stage") ||
    lowerKey.includes("статус")
  ) {
    // If multiple statuses (e.g. "Queue / Draft"), split and render clean pills
    const parts = value.includes("/") ? value.split("/").map((s) => s.trim()) : [value];

    return (
      <div className="flex flex-wrap items-center gap-1 justify-end">
        {parts.map((p, idx) => {
          const pLower = p.toLowerCase();
          let dotColor = "bg-slate-400";

          if (pLower.includes("queue") || pLower.includes("kutil") || pLower.includes("ожид")) {
            dotColor = "bg-amber-500";
          } else if (pLower.includes("run") || pLower.includes("progress") || pLower.includes("jarayon") || pLower.includes("в работе")) {
            dotColor = "bg-blue-500 animate-pulse";
          } else if (pLower.includes("done") || pLower.includes("complete") || pLower.includes("tayyor") || pLower.includes("bajarildi") || pLower.includes("завершен")) {
            dotColor = "bg-emerald-500";
          } else if (pLower.includes("draft") || pLower.includes("qoralama") || pLower.includes("черновик")) {
            dotColor = "bg-slate-400";
          } else if (pLower.includes("crit") || pLower.includes("brak") || pLower.includes("xato") || pLower.includes("stop")) {
            dotColor = "bg-rose-500";
          }

          return (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-muted/60 border border-border text-foreground"
            >
              <span className={cn("size-1.5 rounded-full shrink-0", dotColor)} />
              <span>{p}</span>
            </span>
          );
        })}
      </div>
    );
  }

  // 3. Document Number
  const docNo = extractDocNo(value);
  if (docNo && (lowerKey.includes("hujjat") || lowerKey.includes("doc") || lowerKey.includes("№") || lowerKey.includes("номер"))) {
    return (
      <span className="font-mono font-semibold text-[11px] text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20 select-all">
        {value}
      </span>
    );
  }

  // 4. Quantity / Tiraj
  if (lowerKey.includes("tiraj") || lowerKey.includes("miqdor") || lowerKey.includes("quantity") || lowerKey.includes("soni")) {
    return <span className="font-mono font-semibold text-foreground text-xs">{value}</span>;
  }

  // 5. Deadline / Date
  if (lowerKey.includes("dedlayn") || lowerKey.includes("muddat") || lowerKey.includes("sana") || lowerKey.includes("deadline") || lowerKey.includes("date")) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-foreground font-medium">
        <Calendar className="size-3 text-muted-foreground shrink-0" />
        <span>{value}</span>
      </span>
    );
  }

  // 6. Attached Files
  if (lowerKey.includes("fayl") || lowerKey.includes("biriktirilgan") || lowerKey.includes("file") || lowerKey.includes("attachment")) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded border border-border/50">
        <Paperclip className="size-3 text-primary shrink-0" />
        <span>{value}</span>
      </span>
    );
  }

  // 7. Department / Bo'lim
  if (lowerKey.includes("bo'lim") || lowerKey.includes("dept") || lowerKey.includes("sex") || lowerKey.includes("department")) {
    return (
      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted/70 text-foreground border border-border/60">
        {value}
      </span>
    );
  }

  // 8. Default Text
  return <span className="text-[11px] font-medium text-foreground leading-snug break-words select-text">{value}</span>;
}

// ─── ENTITY CARD RENDERER ────────────────────────────────────────────────────

function EntityCardView({
  segment,
  onOpenDocument,
}: {
  segment: EntityCardSegment;
  onOpenDocument?: (docNo: string, title?: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyCard = () => {
    const text = [
      segment.title,
      "",
      ...segment.fields.map((f) => `• ${f.key}: ${f.value}`),
    ].join("\n");

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const PrimaryIcon = segment.docNo?.startsWith("WO") ? FileText : getFieldIcon(segment.title);

  return (
    <div
      data-slot="copilot-entity-card"
      className="my-2 rounded-md border border-border/80 bg-card text-card-foreground shadow-xs overflow-hidden select-text transition-all"
    >
      {/* Industrial Header Bar */}
      <div className="bg-muted/40 px-3 py-2 border-b border-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <PrimaryIcon className="size-3 text-primary" />
          </div>
          <span className="text-xs font-semibold text-foreground truncate">
            {segment.title}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {segment.docNo && (
            <Badge
              variant="outline"
              className="font-mono text-[10px] h-5 px-1.5 border-primary/30 text-primary bg-primary/5 select-all"
            >
              {segment.docNo}
            </Badge>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopyCard}
            title="Nusxa olish"
            className="size-5 text-muted-foreground hover:text-foreground"
          >
            {copied ? <Check className="size-2.5 text-emerald-600" /> : <Copy className="size-2.5" />}
          </Button>
        </div>
      </div>

      {/* High-Density Key-Value Grid */}
      <div className="divide-y divide-border/30 text-xs bg-background/50">
        {segment.fields.map((field, idx) => {
          const Icon = getFieldIcon(field.key);
          return (
            <div
              key={idx}
              className="flex items-start justify-between py-1.5 px-3 hover:bg-muted/20 transition-colors gap-3"
            >
              <div className="flex items-center gap-1.5 text-muted-foreground shrink-0 min-w-[105px]">
                <Icon className="size-3 text-muted-foreground/70 shrink-0" />
                <span className="text-[11px] font-medium">{field.key}</span>
              </div>
              <div className="text-right">
                <FieldValueRenderer fieldKey={field.key} value={field.value} />
              </div>
            </div>
          );
        })}
      </div>

      {/* 1-Click Action Footer (If Document Number exists) */}
      {segment.docNo && (
        <div className="bg-muted/20 px-3 py-1.5 border-t border-border flex items-center justify-between gap-2">
          <span className="text-[10px] font-mono text-muted-foreground">
            {segment.docNo}
          </span>
          <Button
            variant="outline"
            size="xs"
            onClick={() => onOpenDocument?.(segment.docNo!, segment.title)}
            className="h-6 px-2 text-[10px] font-medium gap-1 bg-background border-border text-foreground hover:border-primary/40 hover:bg-primary/5"
          >
            <FileText className="size-3 text-primary" />
            <span>Hujjatni ochish</span>
            <ArrowRight className="size-2.5 text-muted-foreground" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── MARKDOWN INLINE & BLOCK FORMATTER ───────────────────────────────────────

function renderInlineMarkdown(text: string): React.ReactNode {
  // Regex to split by bold (**text**), inline code (`code`), or italic (*text*)
  const tokens = text.split(/(\*\*.*?\*\*|`.*?`|\*.*?\*)/g);

  return tokens.map((token, i) => {
    if (!token) return null;

    if (token.startsWith("**") && token.endsWith("**") && token.length >= 4) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>
      );
    }

    if (token.startsWith("`") && token.endsWith("`") && token.length >= 2) {
      return (
        <code
          key={i}
          className="font-mono text-[11px] bg-muted/80 text-foreground px-1 py-0.5 rounded border border-border/50"
        >
          {token.slice(1, -1)}
        </code>
      );
    }

    if (token.startsWith("*") && token.endsWith("*") && token.length >= 2) {
      return (
        <em key={i} className="italic text-muted-foreground">
          {token.slice(1, -1)}
        </em>
      );
    }

    return token;
  });
}

function FormattedMarkdownView({ content }: { content: string }) {
  const lines = content.split("\n");

  return (
    <div className="space-y-1.5 text-xs select-text">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1" />;

        // Header ###
        if (trimmed.startsWith("###")) {
          return (
            <h4 key={idx} className="font-semibold text-xs text-foreground mt-2 mb-0.5">
              {renderInlineMarkdown(trimmed.replace(/^###\s*/, ""))}
            </h4>
          );
        }

        // Header ##
        if (trimmed.startsWith("##")) {
          return (
            <h3 key={idx} className="font-semibold text-sm text-foreground mt-2.5 mb-1">
              {renderInlineMarkdown(trimmed.replace(/^##\s*/, ""))}
            </h3>
          );
        }

        // Bullet item
        if (trimmed.startsWith("•") || trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const itemText = trimmed.replace(/^[•\-\*]\s*/, "");
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-1 leading-relaxed">
              <span className="size-1 rounded-full bg-primary/70 mt-1.5 shrink-0" />
              <div className="text-foreground">{renderInlineMarkdown(itemText)}</div>
            </div>
          );
        }

        // Numbered item
        const numMatch = trimmed.match(/^(\d+)\.\s*(.*)$/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-1 leading-relaxed">
              <span className="font-mono text-[10px] text-muted-foreground shrink-0 mt-0.5">
                {numMatch[1]}.
              </span>
              <div className="text-foreground">{renderInlineMarkdown(numMatch[2])}</div>
            </div>
          );
        }

        // Standard paragraph
        return (
          <p key={idx} className="leading-relaxed text-foreground">
            {renderInlineMarkdown(line)}
          </p>
        );
      })}
    </div>
  );
}

// ─── TABLE VIEW ─────────────────────────────────────────────────────────────

function TableView({ segment }: { segment: TableSegment }) {
  return (
    <div className="my-2 overflow-x-auto rounded border border-border bg-card">
      <table className="w-full text-[10px] font-mono text-left">
        <thead className="bg-muted/50 border-b border-border">
          <tr>
            {segment.headers.map((h, i) => (
              <th key={i} className="p-1.5 px-2 font-semibold text-foreground whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {segment.rows.map((row, rIdx) => (
            <tr key={rIdx} className="hover:bg-muted/20">
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="p-1.5 px-2 whitespace-nowrap text-muted-foreground">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── CODE BLOCK VIEW ─────────────────────────────────────────────────────────

function CodeBlockView({ segment }: { segment: CodeBlockSegment }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(segment.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="my-2 rounded border border-border bg-muted/60 overflow-hidden font-mono text-[10px]">
      <div className="flex items-center justify-between px-2.5 py-1 bg-muted/80 border-b border-border text-muted-foreground">
        <span>{segment.language || "text"}</span>
        <button onClick={handleCopy} className="hover:text-foreground">
          {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
        </button>
      </div>
      <pre className="p-2.5 overflow-x-auto text-foreground leading-snug">
        <code>{segment.code}</code>
      </pre>
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export function CopilotMessageRenderer({
  content,
  role = "assistant",
  onOpenDocument,
  className,
}: CopilotMessageRendererProps) {
  const segments = useMemo(() => {
    // If user message, keep it simple
    if (role === "user") {
      return [{ type: "markdown" as const, content }];
    }
    return parseMessageSegments(content);
  }, [content, role]);

  return (
    <div className={cn("copilot-message-flow w-full", className)}>
      {segments.map((seg, idx) => {
        if (seg.type === "entity_card") {
          return (
            <EntityCardView
              key={idx}
              segment={seg}
              onOpenDocument={onOpenDocument}
            />
          );
        }
        if (seg.type === "table") {
          return <TableView key={idx} segment={seg} />;
        }
        if (seg.type === "code_block") {
          return <CodeBlockView key={idx} segment={seg} />;
        }
        return <FormattedMarkdownView key={idx} content={seg.content} />;
      })}
    </div>
  );
}
