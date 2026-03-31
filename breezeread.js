import {
  css,
  html,
  LitElement,
} from "https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js";
import {
  prepare as pretextPrepare,
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
    lineWidths: { type: Array },
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
    this.lineWidths = [];
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

  _prepareLines(text) {
    if (!text || !text.trim()) {
      this.lineWidths = [];
      return [];
    }
    const font = this._getFontString();
    const width = this.columnContentWidth || this._defaultColumnWidth();
    const rootFontSize =
      parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const lineHeight = LINE_HEIGHT_REM * rootFontSize;

    const result = [];
    const widths = [];

    for (const paragraph of text.trim().split("\n")) {
      if (paragraph.trim() === "") {
        result.push("");
        widths.push(null);
        continue;
      }
      try {
        const prepared = pretextPrepare(paragraph, font);
        const { lines } = layoutWithLines(prepared, width, lineHeight);
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          result.push(line.text ?? line);
          // Last line of paragraph stays ragged; others get width for justification
          widths.push(i < lines.length - 1 ? (line.width ?? null) : null);
        }
      } catch {
        // Fallback: simple character-count word wrap (no justification data)
        const words = paragraph.split(" ");
        let current = "";
        for (const word of words) {
          if (current.length + word.length + 1 <= 40) {
            current += (current ? " " : "") + word;
          } else {
            if (current) { result.push(current); widths.push(null); }
            current = word;
          }
        }
        if (current) { result.push(current); widths.push(null); }
      }
    }

    this.lineWidths = widths;
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
      // Re-wrap with new font metrics
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
    // Store original text (not pre-wrapped) so it can be re-wrapped
    // accurately when the font or column width changes
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

    if (currentLine >= this.input.length - 1) {
      return;
    }

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

  _wordSpacing(index) {
    const naturalWidth = this.lineWidths?.[index];
    if (!naturalWidth) return 0;
    const colWidth = this.columnContentWidth || this._defaultColumnWidth();
    const spaceCount = (this.input[index].match(/ /g) || []).length;
    if (spaceCount === 0) return 0;
    // Only justify if the line fills at least 60% of the column
    if (naturalWidth < colWidth * 0.6) return 0;
    return (colWidth - naturalWidth) / spaceCount;
  }

  render() {
    const lines = this.input.map((line, index) => {
      const ws = this._wordSpacing(index);
      return html`
        <div
          class="line ${index === this.currentLine ? "active" : ""}"
          style="${ws ? `word-spacing: ${ws.toFixed(2)}px` : ""}"
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
