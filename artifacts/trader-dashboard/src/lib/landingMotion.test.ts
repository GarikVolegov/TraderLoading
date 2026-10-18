import assert from "node:assert/strict";
import { startLandingMotion } from "./landingMotion";

function harness(reduced = false) {
  const observers: {
    intersection?: {
      fire: (target: FakeElement) => void;
      disconnected: boolean;
      observed: Set<FakeElement>;
    };
    mutation?: { add: (target: FakeElement) => void; disconnected: boolean };
  } = {};
  let change: (() => void) | undefined;
  const preference = {
    matches: reduced,
    addEventListener: (_: string, handler: () => void) => {
      change = handler;
    },
    removeEventListener: () => {
      change = undefined;
    },
  };
  const documentListeners = new Map<string, () => void>();
  const document = {
    defaultView: null as unknown,
    visibilityState: "visible",
    addEventListener: (event: string, handler: () => void) => {
      documentListeners.set(event, handler);
    },
    removeEventListener: (event: string) => {
      documentListeners.delete(event);
    },
  };
  class FakeNode {
    contains(target: unknown) {
      return target === this;
    }
  }
  class FakeElement extends FakeNode {
    dataset: Record<string, string> = {};
    children: FakeElement[] = [];
    parentElement: FakeElement | null = null;
    calls: {
      canceled: boolean;
      finished: boolean;
      effect: { target: FakeElement };
      cancel: () => void;
      finish: () => void;
      addEventListener: (event: string, handler: () => void) => void;
    }[] = [];
    ownerDocument = document;
    listeners = new Map<string, (event: { target: FakeNode }) => void>();
    matches() {
      return this !== root;
    }
    querySelectorAll() {
      return this.children;
    }
    getAnimations() {
      return this.children.flatMap((child) => child.calls);
    }
    animate() {
      const listeners = new Map<string, () => void>();
      const animation = {
        canceled: false,
        finished: false,
        effect: { target: this },
        addEventListener: (event: string, handler: () => void) => {
          listeners.set(event, handler);
        },
        cancel: () => {
          animation.canceled = true;
          listeners.get("cancel")?.();
        },
        finish: () => {
          animation.finished = true;
          listeners.get("finish")?.();
        },
      };
      this.calls.push(animation);
      return animation;
    }
    addEventListener(event: string, handler: (event: { target: FakeNode }) => void) {
      this.listeners.set(event, handler);
    }
    removeEventListener(event: string) {
      this.listeners.delete(event);
    }
  }
  const view = {
    matchMedia: () => preference,
    Node: FakeNode,
    Element: FakeElement,
    IntersectionObserver: class {
      observed = new Set<FakeElement>();
      disconnected = false;
      constructor(
        private callback: (entries: { isIntersecting: boolean; target: FakeElement }[]) => void,
      ) {
        observers.intersection = this;
      }
      observe(target: FakeElement) {
        this.observed.add(target);
      }
      unobserve(target: FakeElement) {
        this.observed.delete(target);
      }
      disconnect() {
        this.disconnected = true;
      }
      fire(target: FakeElement) {
        this.callback([{ isIntersecting: true, target }]);
      }
    },
    MutationObserver: class {
      disconnected = false;
      constructor(private callback: (records: { addedNodes: FakeElement[] }[]) => void) {
        observers.mutation = this;
      }
      observe() {}
      disconnect() {
        this.disconnected = true;
      }
      add(target: FakeElement) {
        this.callback([{ addedNodes: [target] }]);
      }
    },
  };
  document.defaultView = view;
  const root = new FakeElement();
  const card = new FakeElement();
  root.children.push(card);
  card.parentElement = root;
  return {
    root,
    card,
    view,
    start: () => startLandingMotion(root as unknown as HTMLElement),
    reveal: () => observers.intersection!.fire(card),
    intersection: () => observers.intersection!,
    mutation: () => observers.mutation!,
    reduced: (value: boolean) => {
      preference.matches = value;
      change?.();
    },
    visibility: (value: string) => {
      document.visibilityState = value;
      documentListeners.get("visibilitychange")?.();
    },
    documentListeners,
    add: () => {
      const next = new FakeElement();
      root.children.push(next);
      observers.mutation!.add(next);
      return next;
    },
  };
}

// Missing browser APIs leave content untouched and never create an observer.
{
  const h = harness();
  Object.assign(h.view, { IntersectionObserver: undefined });
  h.start()();
  assert.equal(h.card.calls.length, 0);
  assert.deepEqual(h.card.dataset, {});
}
// A reduced-motion preference skips reveals; changing it cancels motion already running.
{
  const h = harness(true);
  const dispose = h.start();
  assert.equal(h.intersection(), undefined);
  h.reduced(false);
  h.reveal();
  assert.equal(h.card.calls.length, 1);
  h.reduced(true);
  assert.equal(h.card.calls[0].canceled, true);
  assert.equal(h.intersection().disconnected, true);
  assert.equal(h.mutation().disconnected, true);
  dispose();
}
// Async sections and manually replaced demo panels register without replaying existing content.
{
  const h = harness();
  const dispose = h.start();
  h.reveal();
  assert.equal(h.intersection().observed.has(h.card), false);
  const next = h.add();
  assert.equal(h.intersection().observed.has(next), true);
  h.reduced(true);
  h.reduced(false);
  assert.equal(h.intersection().observed.has(h.card), false);
  dispose();
}
// Focusing a revealing control completes its reveal immediately; cleanup cancels unfinished work.
{
  const h = harness();
  const dispose = h.start();
  h.reveal();
  h.root.listeners.get("focusin")?.({ target: h.card });
  assert.equal(h.card.calls[0].finished, true);
  dispose();
  assert.equal(h.root.listeners.has("focusin"), false);
  assert.equal(h.intersection().disconnected, true);
}
// Suspended background timelines never hold content at the first, transparent frame.
{
  const h = harness();
  h.visibility("hidden");
  const dispose = h.start();
  assert.equal(h.intersection(), undefined);
  h.visibility("visible");
  h.reveal();
  h.visibility("hidden");
  assert.equal(h.card.calls[0].canceled, true);
  h.visibility("visible");
  assert.equal(h.intersection().observed.has(h.card), false);
  dispose();
  assert.equal(h.documentListeners.has("visibilitychange"), false);
}
console.log("Landing motion fallback, preferences, dynamic content, focus and visibility passed");
