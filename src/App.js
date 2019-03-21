import React, { Component } from "react";
import {
  App,
  Desk,
  // HiddenWord,
  Line,
  InputForm,
  InputText,
  Main,
  SaveTextButton,
  ShowcasedText
} from "./styled-components.js";
import wrapText from "wrap-text";

const wrap = (state, line) => state.concat(wrapText(line, 40).split("\n"));

const htmlEntities = str =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const prepare = text =>
  htmlEntities(text)
    .trim()
    .split("\n")
    .reduce(wrap, [])
    .join("\n");

class Breezeread extends Component {
  constructor(props) {
    super(props);
    this.state = {
      lastAction: "next",
      mode: "keyboard",
      showInputForm: localStorage.text == null,
      input: prepare(localStorage.text || "").split("\n"),
      currentLine: parseInt(sessionStorage.currentLine, 10) || 0,
      isRevealing: false
    };
  }

  componentDidMount() {
    document.addEventListener("keydown", this.handleKeyPress);
  }

  componentWillUnmount() {
    document.removeEventListener("keydown", this.handleKeyPress);
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.currentLine === this.state.currentLine) {
      return;
    }
    const activeElement = document.querySelector(".active");
    if (activeElement) {
      const bounding = activeElement.getBoundingClientRect();
      const isInViewport =
        bounding.top >= 0 &&
        bounding.left >= 0 &&
        bounding.right <= window.innerWidth &&
        bounding.bottom <= window.innerHeight;
      if (isInViewport === false) {
        requestAnimationFrame(() => {
          activeElement.scrollIntoView({
            behavior: "smooth",
            block: this.state.lastAction === "next" ? "start" : "end",
            inline: this.state.lastAction === "next" ? "start" : "end"
          });
        });
      }
    }
  }

  handleKeyPress = event => {
    if (event.key === "k" || event.key === "ArrowUp") {
      this.handlePrevious();
    } else if (event.key === "j" || event.key === "ArrowDown") {
      this.handleNext();
    } else if (event.key === "ArrowRight") {
      this.reveal();
    } else if (event.key === "Delete") {
      this.onClear();
    } else if (event.key === "Escape") {
      this.setState({ mode: this.state.mode !== "all" ? "all" : "keyboard" });
    }
  };

  handleSubmit = event => {
    event.preventDefault();
    if (this.inputRef.value.length === 0) {
      return;
    }

    const text = prepare(this.inputRef.value);
    localStorage.text = text;
    this.setState({
      showInputForm: false,
      mode: "keyboard",
      input: text.split("\n"),
      currentLine: 0
    });
  };

  setInputRef = node => {
    this.inputRef = node;
  };

  reveal = () => {
    this.setState({
      isRevealing: true
    });
  };

  handlePrevious = (delta = 1) => {
    let currentLine =
      this.state.currentLine > 0 ? this.state.currentLine - delta : 0;
    if (this.state.input[currentLine] === "" && currentLine > 0) {
      currentLine--;
    }
    sessionStorage.currentLine = currentLine;
    this.setState({
      lastAction: "previous",
      currentLine,
      isRevealing: false,
      mode: this.state.mode === "all" ? "all" : "keyboard"
    });
  };

  handleNext = (delta = 1) => {
    let currentLine =
      this.state.currentLine < this.state.input.length - delta
        ? this.state.currentLine + delta
        : this.state.currentLine;
    if (
      this.state.input[currentLine] === "" &&
      currentLine < this.state.input.length - 1
    ) {
      currentLine++;
    }
    sessionStorage.currentLine = currentLine;
    this.setState({
      lastAction: "next",
      currentLine,
      isRevealing: false,
      mode: this.state.mode === "all" ? "all" : "keyboard"
    });
  };

  onClear = () => {
    this.setState(
      {
        currentLine: 0,
        input: [],
        showInputForm: true,
        mode: "keyboard"
      },
      () => {
        document.querySelector("textarea").focus();
      }
    );
  };

  selectLine = currentLine => {
    sessionStorage.currentLine = currentLine;
    this.setState({
      currentLine,
      mode: this.state.mode === "all" ? "all" : "keyboard"
    });
  };

  handleMouseMove = () => {
    if (this.state.mode === "keyboard") {
      this.setState({ mode: "mouse" });
    }
  };

  render() {
    const lines = this.state.input.map((line, index) => {
      return (
        <Line
          className={index === this.state.currentLine && "active"}
          current={
            this.state.mode === "all" || index === this.state.currentLine
          }
          key={index}
          onClick={() => this.selectLine(index)}
        >
          <span>{line}</span>
        </Line>
      );
    });

    // const currentLine = lines[this.state.currentLine];
    // const parts =
    //   currentLine &&
    //   currentLine.split(" ").map((word, index) => (
    //     <span key={index}>
    //       {this.state.isRevealing === false && Math.random() > 0.8 ? (
    //         <HiddenWord>{word}</HiddenWord>
    //       ) : (
    //         <span>{word}</span>
    //       )}

    //       <span> </span>
    //     </span>
    //   ));
    return (
      <App>
        <Main onMouseMove={() => this.handleMouseMove()}>
          {this.state.showInputForm && (
            <InputForm onSubmit={this.handleSubmit}>
              <InputText ref={this.setInputRef} />
              <SaveTextButton>Save</SaveTextButton>
            </InputForm>
          )}
          {this.state.showInputForm === false && (
            <Desk>
              <ShowcasedText className={`${this.state.mode}-mode`}>
                {lines}
              </ShowcasedText>
            </Desk>
          )}
        </Main>
      </App>
    );
  }
}

export default Breezeread;
