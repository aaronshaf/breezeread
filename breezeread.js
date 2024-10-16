import {
  css,
  html,
  LitElement,
} from "https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js";

function wrapText(input, width) {
  width = parseInt(width) || 80;
  var res = [],
    cLine = "",
    words = input.split(" ");

  for (var i = 0; i < words.length; ++i) {
    var cWord = words[i];
    if ((cLine + cWord).length <= width) {
      cLine += (cLine ? " " : "") + cWord;
    } else {
      res.push(cLine);
      cLine = cWord;
    }
  }

  if (cLine) {
    res.push(cLine);
  }

  return res.join("\n");
}

const fonts = [
  "Georgia, serif",
  "Merriweather, serif",
  "Lora, serif",
  "Lexend, sans-serif",
  "Atkinson Hyperlegible, sans-serif",
];

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
  };

  constructor() {
    super();
    this.lastAction = "next";
    this.mode = "all";
    this.showInputForm =
      localStorage.text == null || localStorage.text.trim().length < 2;
    this.input = this.prepare(localStorage.text || "").split("\n");
    this.currentLine = parseInt(sessionStorage.currentLine, 10) || 0;
    this.isRevealing = false;
    this.fontIndex = parseInt(localStorage.getItem("fontIndex"), 10) || 0;
    document.body.style.fontFamily = fonts[this.fontIndex];

    this.handleKeyPress = this.handleKeyPress.bind(this);
    this.lastKeyPressed = null;
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("keydown", this.handleKeyPress);
  }

  disconnectedCallback() {
    document.removeEventListener("keydown", this.handleKeyPress);
    super.disconnectedCallback();
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
      this.onClear();
    } else if (event.key === "Escape") {
      this.mode = this.mode !== "all" ? "all" : "keyboard";
    } else if (event.key === "f") {
      this.fontIndex = (this.fontIndex + 1) % fonts.length;
      document.body.style.fontFamily = fonts[this.fontIndex];
      localStorage.setItem("fontIndex", this.fontIndex);
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
    if (this.inputRef.value.trim().length === 0) {
      return;
    }
    const text = this.prepare(this.inputRef.value);
    localStorage.text = text;
    sessionStorage.currentLine = 0;
    this.showInputForm = false;
    this.mode = "all";
    this.input = text.split("\n");
    this.currentLine = 0;
    this.isRevealing = false;
  }

  setInputRef(node) {
    this.inputRef = node;
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

    // Move upwards until an empty line is found
    while (currentLine > 0 && this.input[currentLine - 1] !== "") {
      currentLine--;
    }

    // Now that we're on an empty line, continue moving up until the previous paragraph's first line
    while (currentLine > 0 && this.input[currentLine - 1] === "") {
      currentLine--;
    }

    // Keep moving up until we're at the start of a paragraph or at the top
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
    
    // If already at the last line, do nothing
    if (currentLine >= this.input.length - 1) {
      return;
    }
    
    // Move down until an empty line is found
    while (
      currentLine < this.input.length - 1 &&
      this.input[currentLine + 1] !== ""
    ) {
      currentLine++;
    }
  
    // Skip empty lines until the start of the next paragraph
    while (
      currentLine < this.input.length - 1 &&
      this.input[currentLine + 1] === ""
    ) {
      currentLine++;
    }
  
    // Move to the first line of the next paragraph
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
    localStorage.text = "";
    sessionStorage.currentLine = 0;
    this.currentLine = 0;
    this.input = [];
    this.showInputForm = true;
    this.mode = "keyboard";
    this.updateComplete.then(() => {
      this.shadowRoot.querySelector("textarea").focus();
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

  prepare(text) {
    return text
      .trim()
      .split("\n")
      .reduce((state, line) => state.concat(wrapText(line, 40).split("\n")), [])
      .join("\n");
  }

  render() {
    const lines = this.input.map(
      (line, index) => html`
        <div
          class="line ${index === this.currentLine ? "active" : ""}"
          @click="${() => line.length && this.selectLine(index)}"
        >
          <span>${line}</span>
        </div>
      `
    );

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
                    @input="${(e) => (this.inputRef = e.target)}"
                  ></textarea>
                  <button class="save-text-button" type="submit">Save</button>
                  <pre class="instructions">
                Save text: shift-enter
                Traverse forward: j or up arrow
                Traverse backward: k or down arrow
                Clear text: Delete
                Toggle modes: Escape
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
