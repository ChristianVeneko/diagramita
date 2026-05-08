import { createContext, useCallback, useContext, useMemo, useReducer } from 'react'
import { historyReducer, createInitialHistory } from './reducer.js'

const DiagramContext = createContext(null)

export function DiagramProvider({ children }) {
  const [history, dispatch] = useReducer(historyReducer, undefined, createInitialHistory)

  const apply = useCallback((action, options = {}) => {
    dispatch({ type: 'APPLY', action, record: options.record !== false })
  }, [])

  const undo = useCallback(() => dispatch({ type: 'UNDO' }), [])
  const redo = useCallback(() => dispatch({ type: 'REDO' }), [])
  const reset = useCallback((diagram) => dispatch({ type: 'RESET', diagram }), [])

  const value = useMemo(() => ({
    diagram: history.present,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    apply,
    undo,
    redo,
    reset,
  }), [history, apply, undo, redo, reset])

  return <DiagramContext.Provider value={value}>{children}</DiagramContext.Provider>
}

export function useDiagram() {
  const ctx = useContext(DiagramContext)
  if (!ctx) throw new Error('useDiagram must be used inside DiagramProvider')
  return ctx
}
