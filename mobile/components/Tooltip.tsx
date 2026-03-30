import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

interface TooltipProps {
  label: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ label, children, position = 'top' }: TooltipProps) {
  const [visible, setVisible] = useState(false);

  const hoverProps = Platform.OS === 'web'
    ? { onMouseEnter: () => setVisible(true), onMouseLeave: () => setVisible(false) }
    : {};

  const bubbleStyle = [
    styles.bubble,
    position === 'top' && styles.posTop,
    position === 'bottom' && styles.posBottom,
    position === 'left' && styles.posLeft,
    position === 'right' && styles.posRight,
  ];

  return (
    <View
      style={styles.wrapper}
      accessible={true}
      accessibilityLabel={label}
      {...(hoverProps as any)}
    >
      {children}
      {Platform.OS === 'web' && visible && (
        <View style={bubbleStyle} pointerEvents="none">
          <Text style={styles.text}>{label}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  bubble: {
    position: 'absolute',
    backgroundColor: '#333',
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
    width: 160,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 8,
  },
  posTop: {
    bottom: '110%' as any,
    left: '50%' as any,
    transform: [{ translateX: -80 }],
    marginBottom: 4,
  },
  posBottom: {
    top: '110%' as any,
    left: '50%' as any,
    transform: [{ translateX: -80 }],
    marginTop: 4,
  },
  posLeft: {
    right: '110%' as any,
    top: '50%' as any,
    transform: [{ translateY: -15 }],
    marginRight: 4,
  },
  posRight: {
    left: '110%' as any,
    top: '50%' as any,
    transform: [{ translateY: -15 }],
    marginLeft: 4,
  },
  text: {
    color: '#fff',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
});
