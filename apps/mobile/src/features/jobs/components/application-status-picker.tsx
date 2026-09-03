import { ScrollView, StyleSheet } from 'react-native';

import { AppChip } from '@/components/app-chip';
import { Spacing } from '@/constants/theme';
import { getApplicationStatusAppearance } from '@/features/applications/utils/status-appearance';
import { useTheme } from '@/hooks/use-theme';

import { jobsCopy } from '../copy';
import type { JobApplicationStatus } from '../types/job.types';
import {
  applicationStatusLabel,
  JOB_APPLICATION_STATUSES,
} from '../utils/job-labels';

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
      <AppChip
        label={jobsCopy.notTracking}
        selected={selectedStatus === null}
        onPress={() => onSelect(null)}
      />
      {JOB_APPLICATION_STATUSES.map((status) => {
        const appearance = getApplicationStatusAppearance(status, theme.scheme);
        const selected = selectedStatus === status;

        return (
          <AppChip
            key={status}
            label={applicationStatusLabel(status)}
            selected={selected}
            selectedColor={appearance.backgroundColor}
            selectedTextColor={appearance.textColor}
            onPress={() => onSelect(status)}
          />
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: Spacing.two,
  },
});
