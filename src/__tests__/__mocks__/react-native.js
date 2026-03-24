'use strict';

const React = require('react');

// Minimal react-native mock for node test environment.
// Components render as opaque objects; only logic is tested.
const createStub = (name) => {
  const Stub = ({ children, testID, ...rest }) =>
    React.createElement(name, { testID, ...rest }, children);
  Stub.displayName = name;
  return Stub;
};

module.exports = {
  View: createStub('View'),
  Text: createStub('Text'),
  FlatList: ({ data, renderItem, keyExtractor, ListEmptyComponent, contentContainerStyle }) => {
    if (!data || data.length === 0) {
      return ListEmptyComponent
        ? React.createElement(ListEmptyComponent)
        : null;
    }
    return React.createElement(
      'FlatList',
      null,
      data.map((item, index) => renderItem({ item, index }))
    );
  },
  Pressable: createStub('Pressable'),
  ActivityIndicator: createStub('ActivityIndicator'),
  ScrollView: createStub('ScrollView'),
  StyleSheet: {
    create: (styles) => styles,
    flatten: (style) => style,
    hairlineWidth: 1,
  },
  Platform: { OS: 'ios', select: (obj) => obj.ios ?? obj.default },
  Animated: {
    View: createStub('Animated.View'),
    Text: createStub('Animated.Text'),
    Value: class {
      constructor(val) { this._val = val; }
      setValue(val) { this._val = val; }
    },
    timing: () => ({ start: (cb) => cb && cb({ finished: true }) }),
    spring: () => ({ start: (cb) => cb && cb({ finished: true }) }),
    parallel: (anims) => ({ start: (cb) => { anims.forEach(a => a.start()); cb && cb({ finished: true }); } }),
    sequence: (anims) => ({ start: (cb) => { anims.forEach(a => a.start()); cb && cb({ finished: true }); } }),
  },
};
