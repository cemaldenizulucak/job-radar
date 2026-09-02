import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import {
  applicationStatusLabel,
  JOB_APPLICATION_STATUSES,
} from '../utils/job-labels';
import type { JobApplicationStatus } from '../types/job.types';

type ApplicationStatusPickerProps = {
  selectedStatus: JobApplicationStatus | null;
  onSelect: (status: JobApplicationStatus | null) => void;
};

export function ApplicationStatusPicker({
  selectedStatus,
  onSelect,
}: ApplicationStatusPickerProps) {
  const theme = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}>
      <Pressable
        accessibilityRole="button"
        onPress={() => onSelect(null)}
        style={({ pressed }) => [
          styles.chip,
          {
            backgroundColor:
              selectedStatus === null ? theme.accent : theme.backgroundElement,
            opacity: pressed ? 0.85 : 1,
          },
        ]}>
        <ThemedText
          type="smallBold"
          style={{ color: selectedStatus === null ? '#ffffff' : theme.text }}>
          Not tracking
        </ThemedText>
      </Pressable>
      {JOB_APPLICATION_STATUSES.map((status) => {
        const selected = selectedStatus === status;

        return (
          <Pressable
            key={status}
            accessibilityRole="button"
            onPress={() => onSelect(status)}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: selected ? theme.accent : theme.backgroundElement,
                opacity: pressed ? 0.85 : 1,
              },
            ]}>
            <ThemedText
              type="smallBold"
              style={{ color: selected ? '#ffffff' : theme.text }}>
              {applicationStatusLabel(status)}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: Spacing.two,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
