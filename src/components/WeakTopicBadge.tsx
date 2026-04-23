import { StyleSheet, Text, View } from 'react-native';

type WeakTopicBadgeProps = {
  topic: string;
  value?: string;
};

export function WeakTopicBadge({ topic, value }: WeakTopicBadgeProps) {
  return (
    <View style={styles.badge}>
      <Text style={styles.icon}>!</Text>
      <Text style={styles.topic}>{topic.replace(/_/g, ' ')}</Text>
      {value ? <Text style={styles.value}>{value}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#2A1A1D',
    borderColor: '#7F1D1D',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  icon: {
    color: '#FCA5A5',
    fontSize: 14,
    fontWeight: '800',
  },
  topic: {
    color: '#FDE68A',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  value: {
    color: '#F3F4F6',
    fontSize: 12,
    fontWeight: '700',
  },
});
