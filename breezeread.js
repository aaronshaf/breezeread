import {
  css,
  html,
  LitElement,
} from "https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js";
import {
  prepare as pretextPrepare,
  prepareWithSegments,
  layoutWithLines,
} from "https://esm.sh/@chenglou/pretext";

const fonts = [
  "Georgia, serif",
  "Merriweather, serif",
  "Lora, serif",
  "Lexend, sans-serif",
  "Atkinson Hyperlegible, sans-serif",
];

// column-width: 20rem, padding-left: 20px, padding-right: 12px
const COLUMN_WIDTH_REM = 20;
const LINE_PADDING_PX = 32;
const FONT_SIZE_REM = 1.1;
const LINE_HEIGHT_REM = 1.4;

// ── Knuth-Plass constants (ported from chenglou/pretext demo) ────────────────
const SOFT_HYPHEN = "\u00AD";
const HUGE_BADNESS = 1e8;
const SHORT_LINE_RATIO = 0.6;
const RIVER_THRESHOLD = 1.5;
const INFEASIBLE_SPACE_RATIO = 0.4;
const TIGHT_SPACE_RATIO = 0.65;

const PREFIXES = [
  "anti", "auto", "be", "bi", "co", "com", "con", "contra", "counter", "de",
  "dis", "en", "em", "ex", "extra", "fore", "hyper", "il", "im", "in", "inter",
  "intra", "ir", "macro", "mal", "micro", "mid", "mis", "mono", "multi", "non",
  "omni", "out", "over", "para", "poly", "post", "pre", "pro", "pseudo",
  "quasi", "re", "retro", "semi", "sub", "super", "sur", "syn", "tele", "trans",
  "tri", "ultra", "un", "under",
];

const SUFFIXES = [
  "able", "ible", "tion", "sion", "ment", "ness", "ous", "ious", "eous", "ful",
  "less", "ive", "ative", "itive", "al", "ial", "ical", "ing", "ling",
  "ed", "er", "est", "ism", "ist", "ity", "ety", "ty", "ence", "ance", "ly",
  "fy", "ify", "ize", "ise", "ure", "ture",
];

function isSpaceSegment(text) {
  return text.trim().length === 0;
}

function hyphenateWord(word) {
  // Don't hyphenate contractions or possessives
  if (/['\u2019]/.test(word)) return [word];

  const lower = word.toLowerCase().replace(/[.,;:!?"\u2014\u2013-]/g, "");
  if (lower.length < 6) return [word];

  for (const prefix of PREFIXES) {
    // Only use prefixes of 3+ chars to avoid false matches (co-, de-, re-, etc.)
    if (prefix.length < 3) continue;
    if (lower.startsWith(prefix) && lower.length - prefix.length >= 4) {
      return [word.slice(0, prefix.length), word.slice(prefix.length)];
    }
  }
  for (const suffix of SUFFIXES) {
    // Only use suffixes of 3+ chars
    if (suffix.length < 3) continue;
    if (lower.endsWith(suffix) && lower.length - suffix.length >= 4) {
      const cut = word.length - suffix.length;
      return [word.slice(0, cut), word.slice(cut)];
    }
  }
  return [word];
}

function hyphenateParagraph(paragraph) {
  return paragraph.split(/(\s+)/).map((token) => {
    if (/^\s+$/.test(token)) return token;
    const parts = hyphenateWord(token);
    return parts.length <= 1 ? token : parts.join(SOFT_HYPHEN);
  }).join("");
}

function getLineStats(segments, widths, candidates, from, to, hyphenWidth, normalSpaceWidth) {
  const fromIdx = candidates[from].segIndex;
  const toIdx = candidates[to].segIndex;
  const trailingMarker = candidates[to].kind === "soft-hyphen" ? "soft-hyphen" : "none";

  let wordWidth = 0, spaceCount = 0;
  for (let i = fromIdx; i < toIdx; i++) {
    const t = segments[i];
    if (t === SOFT_HYPHEN) continue;
    if (isSpaceSegment(t)) { spaceCount++; continue; }
    wordWidth += widths[i];
  }
  // Trim trailing space
  if (toIdx > fromIdx && isSpaceSegment(segments[toIdx - 1])) spaceCount--;
  if (trailingMarker === "soft-hyphen") wordWidth += hyphenWidth;

  return {
    wordWidth,
    spaceCount,
    naturalWidth: wordWidth + spaceCount * normalSpaceWidth,
    trailingMarker,
  };
}

function lineBadness(stats, maxWidth, normalSpaceWidth, isLastLine) {
  if (isLastLine) return stats.wordWidth > maxWidth ? HUGE_BADNESS : 0;

  if (stats.spaceCount <= 0) {
    const slack = maxWidth - stats.wordWidth;
    return slack < 0 ? HUGE_BADNESS : slack * slack * 10;
  }

  const justifiedSpace = (maxWidth - stats.wordWidth) / stats.spaceCount;
  if (justifiedSpace < 0) return HUGE_BADNESS;
  if (justifiedSpace < normalSpaceWidth * INFEASIBLE_SPACE_RATIO) return HUGE_BADNESS;

  const ratio = (justifiedSpace - normalSpaceWidth) / normalSpaceWidth;
  const a = Math.abs(ratio);
  const badness = a * a * a * 1000;

  const riverExcess = justifiedSpace / normalSpaceWidth - RIVER_THRESHOLD;
  const riverPenalty = riverExcess > 0 ? 5000 + riverExcess * riverExcess * 10000 : 0;

  const tightThreshold = normalSpaceWidth * TIGHT_SPACE_RATIO;
  const tightPenalty = justifiedSpace < tightThreshold
    ? 3000 + (tightThreshold - justifiedSpace) * (tightThreshold - justifiedSpace) * 10000
    : 0;

  const hyphenPenalty = stats.trailingMarker === "soft-hyphen" ? 50 : 0;
  return badness + riverPenalty + tightPenalty + hyphenPenalty;
}

function buildLineFromRange(prepared, candidates, from, to, maxWidth, hyphenWidth, normalSpaceWidth) {
  const fromIdx = candidates[from].segIndex;
  const toIdx = candidates[to].segIndex;
  const ending = candidates[to].kind === "end" ? "paragraph-end" : "wrap";
  const trailingMarker = candidates[to].kind === "soft-hyphen" ? "soft-hyphen" : "none";

  const segs = [];
  for (let i = fromIdx; i < toIdx; i++) {
    const t = prepared.segments[i];
    if (t === SOFT_HYPHEN) continue;
    segs.push(isSpaceSegment(t)
      ? { kind: "space", width: prepared.widths[i] }
      : { kind: "text", text: t, width: prepared.widths[i] });
  }
  if (trailingMarker === "soft-hyphen" && ending === "wrap") {
    segs.push({ kind: "text", text: "-", width: hyphenWidth });
  }
  // Trim trailing spaces
  while (segs.length > 0 && segs[segs.length - 1].kind === "space") segs.pop();

  let wordWidth = 0, spaceCount = 0, naturalWidth = 0;
  for (const s of segs) {
    naturalWidth += s.width;
    if (s.kind === "space") spaceCount++;
    else wordWidth += s.width;
  }

  const text = segs.map((s) => (s.kind === "text" ? s.text : " ")).join("");

  // Compute CSS word-spacing: extra px per inter-word gap
  let wordSpacing = null;
  if (ending !== "paragraph-end" && spaceCount > 0 && naturalWidth >= maxWidth * SHORT_LINE_RATIO) {
    const rawJustifiedSpace = (maxWidth - wordWidth) / spaceCount;
    wordSpacing = rawJustifiedSpace - normalSpaceWidth;
  }

  return { text, wordSpacing };
}

function layoutParagraphKnuthPlass(prepared, maxWidth, normalSpaceWidth, hyphenWidth) {
  const { segments, widths } = prepared;
  const n = segments.length;
  if (n === 0) return [];

  // Build break candidates
  const candidates = [{ segIndex: 0, kind: "start" }];
  for (let i = 0; i < n; i++) {
    const t = segments[i];
    if (t === SOFT_HYPHEN) {
      if (i + 1 < n) candidates.push({ segIndex: i + 1, kind: "soft-hyphen" });
      continue;
    }
    if (isSpaceSegment(t) && i + 1 < n) {
      candidates.push({ segIndex: i + 1, kind: "space" });
    }
  }
  candidates.push({ segIndex: n, kind: "end" });

  const N = candidates.length;
  const dp = new Array(N).fill(Infinity);
  const prev = new Array(N).fill(-1);
  dp[0] = 0;

  for (let to = 1; to < N; to++) {
    const isLastLine = candidates[to].kind === "end";
    for (let from = to - 1; from >= 0; from--) {
      if (dp[from] === Infinity) continue;
      const stats = getLineStats(segments, widths, candidates, from, to, hyphenWidth, normalSpaceWidth);
      if (stats.naturalWidth > maxWidth * 2) break;
      const cost = dp[from] + lineBadness(stats, maxWidth, normalSpaceWidth, isLastLine);
      if (cost < dp[to]) {
        dp[to] = cost;
        prev[to] = from;
      }
    }
  }

  // Backtrack
  const breakAt = [];
  let cur = N - 1;
  while (cur > 0) {
    if (prev[cur] === -1) { cur--; continue; }
    breakAt.push(cur);
    cur = prev[cur];
  }
  breakAt.reverse();

  // Build lines
  const lines = [];
  let fromCandidate = 0;
  for (const toCandidate of breakAt) {
    lines.push(buildLineFromRange(prepared, candidates, fromCandidate, toCandidate, maxWidth, hyphenWidth, normalSpaceWidth));
    fromCandidate = toCandidate;
  }
  return lines;
}

// ─────────────────────────────────────────────────────────────────────────────

class Breezeread extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .app {
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      left: 0;
      display: flex;
      flex-direction: column;
    }

    .main {
      display: flex;
      flex: 1;
      flex-direction: column;
    }

    .input-form {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 16px;
    }

    .save-text-button {
      margin-top: 8px;
      font-size: 1.2rem;
      border: 1px solid grey;
      padding: 12px;
    }

    .instructions {
      line-height: 1.4rem;
    }

    .input-text {
      flex: 1;
      padding: 12px;
      font-size: 1.1rem;
    }

    .desk {
      display: flex;
      flex: 1;
      line-height: 1.4rem;
      padding-top: 20px;
      padding-bottom: 20px;
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
    }

    .showcased-text {
      font-size: 1.1rem;
      columns: 12em;
      height: 100%;
      column-gap: 0px;
      column-width: 20rem;
      flex: 1;
      column-fill: auto;
    }

    .line {
      white-space: nowrap;
      padding-left: 20px;
      padding-right: 12px;
      pointer-events: fill;
      min-height: 1.55rem;
    }

    .line:not(.active) {
      color: transparent;
    }

    .line.active {
      color: black;
    }

    .all-mode .line {
      color: black;
    }

    .mouse-mode .line:hover:not(.active) {
      color: black;
      cursor: pointer;
    }

    .line span {
      padding: 3px 4px;
    }

    .all-mode .line.active span {
      background-color: #ffff99;
    }

    .keyboard-mode .line {
      cursor: none;
    }
  `;

  static properties = {
    lastAction: { type: String },
    mode: { type: String },
    showInputForm: { type: Boolean },
    input: { type: Array },
    currentLine: { type: Number },
    isRevealing: { type: Boolean },
    fontIndex: { type: Number },
    lastKeyPressed: { type: String },
    columnContentWidth: { type: Number },
    lineWordSpacings: { type: Array },
  };

  constructor() {
    super();
    this.lastAction = "next";
    this.mode = "all";

    // v2: text is stored raw (unwrapped). Clear old pre-wrapped text so
    // users aren't stuck with orphan lines from the old format.
    if (localStorage.getItem("textVersion") !== "2") {
      localStorage.removeItem("text");
      localStorage.setItem("textVersion", "2");
    }

    this.showInputForm =
      localStorage.text == null || localStorage.text.trim().length < 2;
    this.fontIndex = parseInt(localStorage.getItem("fontIndex"), 10) || 0;
    document.body.style.fontFamily = fonts[this.fontIndex];
    this.columnContentWidth = this._defaultColumnWidth();
    this.lineWordSpacings = [];
    this.input = this._prepareLines(localStorage.text || "");
    this.currentLine = parseInt(sessionStorage.currentLine, 10) || 0;
    this.isRevealing = false;
    this.handleKeyPress = this.handleKeyPress.bind(this);
    this.lastKeyPressed = null;
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("keydown", this.handleKeyPress);
  }

  disconnectedCallback() {
    document.removeEventListener("keydown", this.handleKeyPress);
    this._resizeObserver?.disconnect();
    super.disconnectedCallback();
  }

  firstUpdated() {
    this._measureAndRewrap();

    // Re-wrap whenever the column width changes (window resize, zoom, etc.)
    this._resizeObserver = new ResizeObserver(() => this._measureAndRewrap());
    const desk = this.shadowRoot.querySelector(".desk");
    if (desk) this._resizeObserver.observe(desk);
  }

  _measureAndRewrap() {
    const lineEl = this.shadowRoot.querySelector(".line");
    if (!lineEl) return;
    const actualWidth = lineEl.getBoundingClientRect().width - LINE_PADDING_PX;
    if (actualWidth > 0 && Math.abs(actualWidth - this.columnContentWidth) > 10) {
      this.columnContentWidth = actualWidth;
      this.input = this._prepareLines(localStorage.text || "");
    }
  }

  updated(changedProperties) {
    if (changedProperties.has("currentLine")) {
      const activeElement = this.shadowRoot.querySelector(".active");
      if (activeElement) {
        const bounding = activeElement.getBoundingClientRect();
        const isInViewport =
          bounding.left >= 0 && bounding.right <= window.innerWidth;
        if (!isInViewport) {
          requestAnimationFrame(() => {
            document.body.scrollLeft = activeElement.offsetLeft;
          });
        }
      }
    }
  }

  _defaultColumnWidth() {
    const rootFontSize =
      parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    return COLUMN_WIDTH_REM * rootFontSize - LINE_PADDING_PX;
  }

  _getFontString() {
    const rootFontSize =
      parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const fontSize = FONT_SIZE_REM * rootFontSize;
    return `${fontSize}px ${fonts[this.fontIndex]}`;
  }

  _measureSpaceWidths() {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    ctx.font = this._getFontString();
    return {
      normalSpaceWidth: ctx.measureText(" ").width,
      hyphenWidth: ctx.measureText("-").width,
    };
  }

  _prepareLines(text) {
    if (!text || !text.trim()) {
      this.lineWordSpacings = [];
      return [];
    }
    const font = this._getFontString();
    const maxWidth = this.columnContentWidth || this._defaultColumnWidth();
    const { normalSpaceWidth, hyphenWidth } = this._measureSpaceWidths();

    const result = [];
    const spacings = [];

    for (const paragraph of text.trim().split("\n")) {
      if (paragraph.trim() === "") {
        result.push("");
        spacings.push(null);
        continue;
      }
      try {
        const hyphenated = hyphenateParagraph(paragraph);
        const prepared = prepareWithSegments(hyphenated, font);
        const lines = layoutParagraphKnuthPlass(prepared, maxWidth, normalSpaceWidth, hyphenWidth);
        for (const line of lines) {
          result.push(line.text);
          spacings.push(line.wordSpacing);
        }
      } catch {
        // Fallback to greedy layout without justification
        try {
          const rootFontSize =
            parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
          const prepared = pretextPrepare(paragraph, font);
          const { lines } = layoutWithLines(prepared, maxWidth, LINE_HEIGHT_REM * rootFontSize);
          for (let i = 0; i < lines.length; i++) {
            result.push(lines[i].text ?? lines[i]);
            spacings.push(null);
          }
        } catch {
          result.push(paragraph);
          spacings.push(null);
        }
      }
    }

    this.lineWordSpacings = spacings;
    return result;
  }

  handleKeyPress(event) {
    if (event.key === "k" || event.key === "ArrowUp") {
      this.handlePrevious();
    } else if (event.key === "j" || event.key === "ArrowDown") {
      this.handleNext();
    } else if (event.key === "{") {
      this.handlePreviousParagraph();
    } else if (event.key === "}") {
      this.handleNextParagraph();
    } else if (event.key === "ArrowRight") {
      this.reveal();
    } else if (event.key === "Backspace") {
      event.preventDefault();
      this.onClear();
    } else if (event.key === "Escape") {
      this.mode = this.mode !== "all" ? "all" : "keyboard";
    } else if (event.key === "f") {
      this.fontIndex = (this.fontIndex + 1) % fonts.length;
      document.body.style.fontFamily = fonts[this.fontIndex];
      localStorage.setItem("fontIndex", this.fontIndex);
      this.input = this._prepareLines(localStorage.text || "");
    } else if (event.key === "g") {
      if (this.lastKeyPressed === "g") {
        this.currentLine = 0;
      }
    } else if (event.key === "G") {
      this.currentLine = this.input.length - 1;
    }
    this.lastKeyPressed = event.key;
  }

  handleSubmit(event) {
    event.preventDefault();

    const textarea = this.shadowRoot.querySelector("textarea");

    if (textarea.value.trim().length === 0) {
      return;
    }
    localStorage.text = textarea.value;
    sessionStorage.currentLine = 0;
    this.showInputForm = false;
    this.mode = "all";
    this.input = this._prepareLines(textarea.value);
    this.currentLine = 0;
    this.isRevealing = false;
  }

  reveal() {
    this.isRevealing = true;
  }

  handlePrevious(delta = 1) {
    let currentLine = this.currentLine > 0 ? this.currentLine - delta : 0;
    if (this.input[currentLine] === "" && currentLine > 0) {
      currentLine--;
    }
    sessionStorage.currentLine = currentLine;
    this.lastAction = "previous";
    this.currentLine = currentLine;
    this.isRevealing = false;
    this.mode = this.mode === "all" ? "all" : "keyboard";
  }

  handleNext(delta = 1) {
    let currentLine =
      this.currentLine < this.input.length - delta
        ? this.currentLine + delta
        : this.currentLine;
    if (this.input[currentLine] === "" && currentLine < this.input.length - 1) {
      currentLine++;
    }
    sessionStorage.currentLine = currentLine;
    this.lastAction = "next";
    this.currentLine = currentLine;
    this.isRevealing = false;
    this.mode = this.mode === "all" ? "all" : "keyboard";
  }

  handlePreviousParagraph() {
    let currentLine = this.currentLine;

    while (currentLine > 0 && this.input[currentLine - 1] !== "") {
      currentLine--;
    }
    while (currentLine > 0 && this.input[currentLine - 1] === "") {
      currentLine--;
    }
    while (currentLine > 0 && this.input[currentLine - 1] !== "") {
      currentLine--;
    }

    this.currentLine = currentLine;
    sessionStorage.currentLine = currentLine;
    this.lastAction = "previous-paragraph";
    this.isRevealing = false;
    this.mode = this.mode === "all" ? "all" : "keyboard";
  }

  handleNextParagraph() {
    let currentLine = this.currentLine;

    if (currentLine >= this.input.length - 1) return;

    while (
      currentLine < this.input.length - 1 &&
      this.input[currentLine + 1] !== ""
    ) {
      currentLine++;
    }
    while (
      currentLine < this.input.length - 1 &&
      this.input[currentLine + 1] === ""
    ) {
      currentLine++;
    }
    if (currentLine < this.input.length - 1) {
      currentLine++;
    }

    this.currentLine = currentLine;
    sessionStorage.currentLine = currentLine;
    this.lastAction = "next-paragraph";
    this.isRevealing = false;
    this.mode = this.mode === "all" ? "all" : "keyboard";
  }

  onClear() {
    this.showInputForm = true;
    this.mode = "keyboard";
    this.updateComplete.then(() => {
      const textarea = this.shadowRoot.querySelector("textarea");
      if (textarea) {
        textarea.select();
      }
    });
  }

  selectLine(currentLine) {
    sessionStorage.currentLine = currentLine;
    this.currentLine = currentLine;
    this.mode = this.mode === "all" ? "all" : "keyboard";
  }

  handleMouseMove() {
    if (this.mode === "keyboard") {
      this.mode = "mouse";
    }
  }

  handleInputTextKeyDown(event) {
    const isShiftEnter = event.shiftKey && event.key === "Enter";
    if (isShiftEnter) {
      this.handleSubmit(event);
    }
  }

  render() {
    const lines = this.input.map((line, index) => {
      const ws = this.lineWordSpacings?.[index];
      return html`
        <div
          class="line ${index === this.currentLine ? "active" : ""}"
          style="${ws != null ? `word-spacing: ${ws.toFixed(2)}px` : ""}"
          @click="${() => line.length && this.selectLine(index)}"
        >
          <span>${line}</span>
        </div>
      `;
    });

    return html`
      <div class="app">
        <div class="main" @mousemove="${this.handleMouseMove}">
          ${this.showInputForm
            ? html`
                <form class="input-form" @submit="${this.handleSubmit}">
                  <textarea
                    class="input-text"
                    @keydown="${this.handleInputTextKeyDown}"
                    .value="${localStorage.text || ""}"
                  ></textarea>
                  <button class="save-text-button" type="submit">Save</button>
                  <pre class="instructions">
                Save text: shift-enter
                Traverse forward: j or up arrow
                Traverse backward: k or down arrow
                Clear text: Delete
                Toggle modes: Escape
                Cycle fonts: f
                Jump to end: G
                Jump to beginning: gg
                Next paragraph/block: }
                Previous paragraph/block: {
              </pre
                  >
                </form>
              `
            : html`
                <div class="desk">
                  <div class="showcased-text ${this.mode}-mode">${lines}</div>
                </div>
              `}
        </div>
      </div>
    `;
  }
}

customElements.define("breezeread-app", Breezeread);
