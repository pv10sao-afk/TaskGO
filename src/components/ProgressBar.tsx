import { StyleSheet, Text, View } from 'react-native';
import { C } from '../constants/theme';

type ProgressBarProps = {
  label: string;
  progress: number;
};

export function ProgressBar({ label, progress }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, progress));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{Math.round(pct * 100)}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  header: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { color: C.textSub, fontSize: 13, fontWeight: '600' },
  value: { color: C.accentLight, fontSize: 13, fontWeight: '700' },
  track: {
    backgroundColor: C.surface,
    borderRadius: 999,
    height: 8,
    overflow: 'hidden',
  },
  fill: {
    backgroundColor: C.accent,
    borderRadius: 999,
    height: '100%',
  },
});
