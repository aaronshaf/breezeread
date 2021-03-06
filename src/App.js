import React, { Component } from "react";
import {
  App,
  Desk,
  // HiddenWord,
  Line,
  Instructions,
  InputForm,
  InputText,
  Main,
  SaveTextButton,
  ShowcasedText
} from "./styled-components.js";
import wrapText from "wrap-text";

const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

const wrap = (state, line) => state.concat(wrapText(line, 40).split("\n"));

const prepare = text =>
  text
    .trim()
    .split("\n")
    .reduce(wrap, [])
    .join("\n");

class Breezeread extends Component {
  constructor(props) {
    super(props);
    this.state = {
      lastAction: "next",
      mode: "all",
      showInputForm:
        localStorage.text == null || localStorage.text.trim().length < 2,
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
        bounding.left >= 0 && bounding.right <= window.innerWidth;
      if (isInViewport === false) {
        requestAnimationFrame(() => {
          if (isSafari) {
            document.body.scrollLeft = activeElement.offsetLeft;
          } else {
            activeElement.scrollIntoView({
              behavior: "smooth",
              block: this.state.lastAction === "next" ? "start" : "end",
              inline: this.state.lastAction === "next" ? "start" : "end"
            });
          }
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
    } else if (event.key === "Backspace") {
      this.onClear();
    } else if (event.key === "Escape") {
      this.setState({ mode: this.state.mode !== "all" ? "all" : "keyboard" });
    }
  };

  handleSubmit = event => {
    event.preventDefault();
    if (this.inputRef.value.trim().length === 0) {
      return;
    }
    const text = prepare(this.inputRef.value);
    localStorage.text = text;
    sessionStorage.currentLine = 0;
    this.setState({
      lastAction: "next",
      showInputForm: false,
      mode: "all",
      input: text.split("\n"),
      currentLine: 0,
      isRevealing: false
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
    localStorage.text = "";
    sessionStorage.currentLine = 0;
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

  handleInputTextKeyDown = event => {
    const isShiftEnter = event.shiftKey && event.key === "Enter";
    if (isShiftEnter) {
      this.handleSubmit(event);
    }
  };

  render() {
    const lines = this.state.input.map((line, index) => {
      return (
        <Line
          className={index === this.state.currentLine && "active"}
          key={index}
          onClick={() => line.length && this.selectLine(index)}
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
              <InputText
                onKeyDown={this.handleInputTextKeyDown}
                ref={this.setInputRef}
              />
              <SaveTextButton>Save</SaveTextButton>
              <Instructions>
                {`Save text: shift-enter
Traverse forward: j or up arrow
Traverse backward: k or down arrow
Clear text: Delete
Toggle modes: Escape`}
              </Instructions>
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
