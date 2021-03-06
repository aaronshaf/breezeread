import styled from "@emotion/styled/macro";

export const Line = styled.div`
  white-space: nowrap;
  padding-left: 20px;
  padding-right: 12px;
  pointer-events: fill;
  min-height: 1.4rem;
  &:not(.active) {
    color: transparent;
  }
  &.active {
    color: black;
  }
  .all-mode & {
    color: black;
  }
  .mouse-mode &:hover:not(.active) {
    color: black;
    cursor: pointer;
  }
  & span {
    padding: 3px 4px;
  }
  .all-mode &.active span {
    background-color: #ffff99;
  }
  .keyboard-mode & {
    cursor: none;
  }
`;

export const App = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  flex-direction: column;
`;

export const Main = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
`;

export const InputForm = styled.form`
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px;
`;

export const SaveTextButton = styled.button`
  margin-top: 8px;
  font-size: 1.2rem;
  border: 1px solid grey;
  padding: 12px;
`;
SaveTextButton.defaultProps = { type: "submit" };

export const Instructions = styled.pre`
  line-height: 1.4rem;
`;

export const InputText = styled.textarea`
  flex: 1;
  padding: 12px;
  font-size: 1.1rem;
`;

export const Desk = styled.div`
  display: flex;
  flex: 1;
  line-height: 1.4rem;
  padding-top: 20px;
  padding-bottom: 20px;
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
`;

export const Progress = styled.progress`
  -webkit-appearance: none;
  appearance: none;
  &::-webkit-progress-bar {
    height: 1px;
    background-color: #ddd;
  }
  &::-webkit-progress-value {
    height: 1px;
    background-color: white;
  }
  &::-moz-progress-bar {
    height: 1px;
    background-color: white;
  }
`;

export const ShowcasedText = styled.div`
  font-size: 0.9rem;
  columns: 12em;
  height: 100%;
  column-gap: 0px;
  column-width: 20rem;
  flex: 1;
  column-fill: auto;
`;

export const Controls = styled.div`
  display: flex;
  justify-content: center;
`;

export const ClearButton = styled.button``;

export const HiddenWord = styled.span`
  background-color: #eee;
  color: #eee;
  &:hover {
    background-color: transparent;
    color: black;
  }
`;
