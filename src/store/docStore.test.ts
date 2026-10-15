import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyDoc } from '../model/factory';
import { beginGesture, redo, undo, useDocStore } from './docStore';

const state = () => useDocStore.getState();

beforeEach(() => {
  state().replaceDoc(createEmptyDoc());
  useDocStore.temporal.getState().clear();
});

describe('docStore undo/redo', () => {
  it('undoes and redoes adding a seal', () => {
    state().addSeal(10, 10);
    expect(state().doc.instances).toHaveLength(1);
    undo();
    expect(state().doc.instances).toHaveLength(0);
    redo();
    expect(state().doc.instances).toHaveLength(1);
  });

  it('groups a gesture into a single undo step', () => {
    const id = state().addSeal(10, 10);
    const g = beginGesture();
    for (let x = 11; x <= 20; x++) g.step(() => state().updateInstance(id, { x }));
    g.end();
    expect(state().doc.instances[0].x).toBe(20);
    undo();
    expect(state().doc.instances[0].x).toBe(10);
  });
});
