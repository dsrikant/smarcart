// Required for react-test-renderer to work correctly in React 19 (node env).
// Without this, act() warnings are suppressed and renders return null.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
