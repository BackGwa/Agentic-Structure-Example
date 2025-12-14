const KEY_TO_ACTION = new Map([
  ["ArrowLeft", "left"],
  ["ArrowRight", "right"],
  ["ArrowDown", "down"],
  ["ArrowUp", "rotCW"],
  ["Space", "hardDrop"],
  ["KeyZ", "rotCCW"],
  ["KeyX", "rotCW"],
  ["KeyC", "hold"],
  ["KeyP", "pause"],
  ["KeyR", "restart"],
  ["KeyM", "mute"],
]);

function isTypingTarget(target) {
  if (!target) return false;
  const tag = target.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || target.isContentEditable;
}

export class InputController {
  constructor({ onAction, onFirstGesture }) {
    this.onAction = onAction;
    this.onFirstGesture = onFirstGesture ?? (() => {});
    this.hasGesture = false;

    this.repeatTimers = new Map();
    this.boundKeyDown = (event) => this.handleKeyDown(event);
    this.boundKeyUp = (event) => this.handleKeyUp(event);
  }

  attach() {
    window.addEventListener("keydown", this.boundKeyDown);
    window.addEventListener("keyup", this.boundKeyUp);
  }

  detach() {
    window.removeEventListener("keydown", this.boundKeyDown);
    window.removeEventListener("keyup", this.boundKeyUp);
    this.stopAllRepeats();
  }

  ensureGesture() {
    if (this.hasGesture) return;
    this.hasGesture = true;
    this.onFirstGesture();
  }

  handleKeyDown(event) {
    if (isTypingTarget(event.target)) return;
    const code = event.code;
    const action = KEY_TO_ACTION.get(code);
    if (!action) return;
    event.preventDefault();
    this.ensureGesture();

    if (action === "restart" || action === "mute") {
      this.onAction(action, { source: "keyboard" });
      return;
    }

    // Handle key repeat ourselves for consistent feel.
    if (event.repeat) return;
    this.onAction(action, { source: "keyboard" });
    if (action === "left" || action === "right" || action === "down") {
      this.startRepeat(action);
    }
  }

  handleKeyUp(event) {
    const action = KEY_TO_ACTION.get(event.code);
    if (!action) return;
    if (action === "left" || action === "right" || action === "down") {
      this.stopRepeat(action);
    }
  }

  startRepeat(action) {
    this.stopRepeat(action);
    const dasMs = 140;
    const arrMs = action === "down" ? 28 : 48;
    const timeoutId = window.setTimeout(() => {
      const intervalId = window.setInterval(() => {
        this.onAction(action, { source: "repeat" });
      }, arrMs);
      this.repeatTimers.set(action, { timeoutId: null, intervalId });
    }, dasMs);
    this.repeatTimers.set(action, { timeoutId, intervalId: null });
  }

  stopRepeat(action) {
    const timers = this.repeatTimers.get(action);
    if (!timers) return;
    if (timers.timeoutId != null) window.clearTimeout(timers.timeoutId);
    if (timers.intervalId != null) window.clearInterval(timers.intervalId);
    this.repeatTimers.delete(action);
  }

  stopAllRepeats() {
    for (const action of this.repeatTimers.keys()) this.stopRepeat(action);
  }

  attachTouchButtons(container) {
    const start = (event) => {
      const button = event.target.closest?.("[data-action]");
      if (!button) return;
      event.preventDefault();
      this.ensureGesture();
      const action = button.getAttribute("data-action");
      this.onAction(action, { source: "touch" });
      if (action === "left" || action === "right" || action === "down") {
        this.startTouchRepeat(action);
      }
    };

    const end = (event) => {
      const button = event.target.closest?.("[data-action]");
      if (!button) return;
      event.preventDefault();
      const action = button.getAttribute("data-action");
      if (action === "left" || action === "right" || action === "down") {
        this.stopRepeat(action);
      }
    };

    container.addEventListener("pointerdown", start);
    container.addEventListener("pointerup", end);
    container.addEventListener("pointercancel", end);
    container.addEventListener("pointerleave", end);
  }

  startTouchRepeat(action) {
    // Slightly slower than keyboard to feel better on touch.
    this.stopRepeat(action);
    const dasMs = 170;
    const arrMs = action === "down" ? 40 : 72;
    const timeoutId = window.setTimeout(() => {
      const intervalId = window.setInterval(() => {
        this.onAction(action, { source: "touchRepeat" });
      }, arrMs);
      this.repeatTimers.set(action, { timeoutId: null, intervalId });
    }, dasMs);
    this.repeatTimers.set(action, { timeoutId, intervalId: null });
  }
}

