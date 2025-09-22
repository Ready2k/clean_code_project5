import { describe, it, expect } from 'vitest';
import renderingReducer, {
  clearRenders,
  toggleCompareMode,
  toggleRenderSelection,
  clearRenderSelection,
} from '../renderingSlice';

describe('renderingSlice', () => {
  const initialState = {
    renders: {},
    activeRenders: [],
    isLoading: false,
    error: null,
    compareMode: false,
    selectedRenders: [],
  };

  it('should return the initial state', () => {
    expect(renderingReducer(undefined, { type: 'unknown' })).toEqual(initialState);
  });

  it('should handle clearRenders', () => {
    const previousState = {
      ...initialState,
      renders: { 'render-1': {} as any },
      activeRenders: ['render-1'],
      selectedRenders: ['render-1'],
    };

    expect(renderingReducer(previousState, clearRenders())).toEqual(initialState);
  });

  it('should handle toggleCompareMode', () => {
    expect(renderingReducer(initialState, toggleCompareMode())).toEqual({
      ...initialState,
      compareMode: true,
    });

    const compareState = { ...initialState, compareMode: true };
    expect(renderingReducer(compareState, toggleCompareMode())).toEqual({
      ...initialState,
      compareMode: false,
      selectedRenders: [],
    });
  });

  it('should handle toggleRenderSelection', () => {
    const state = renderingReducer(initialState, toggleRenderSelection('render-1'));
    expect(state.selectedRenders).toEqual(['render-1']);

    const state2 = renderingReducer(state, toggleRenderSelection('render-2'));
    expect(state2.selectedRenders).toEqual(['render-1', 'render-2']);

    const state3 = renderingReducer(state2, toggleRenderSelection('render-1'));
    expect(state3.selectedRenders).toEqual(['render-2']);
  });

  it('should handle clearRenderSelection', () => {
    const previousState = {
      ...initialState,
      selectedRenders: ['render-1', 'render-2'],
    };

    expect(renderingReducer(previousState, clearRenderSelection())).toEqual({
      ...initialState,
      selectedRenders: [],
    });
  });
});