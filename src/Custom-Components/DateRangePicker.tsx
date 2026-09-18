import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Modal,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import dayjs from 'dayjs';
import { THEME } from '../utils/theme';

// Design-system tokens (see src/theme/theme.ts).
const { colors, spacing, radius, typography } = THEME;

interface DatePreset {
  label: string;
  from: Date;
  to: Date;
}

interface DateRangePickerProps {
  fromDate: Date;
  toDate: Date;
  onFromChange: (date: Date) => void;
  onToChange: (date: Date) => void;
  presets?: DatePreset[];
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  fromDate,
  toDate,
  onFromChange,
  onToChange,
  presets = [],
}) => {
  const [showPicker, setShowPicker] = useState<'from' | 'to' | null>(null);

  const handleDateChange = (
    _event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    if (Platform.OS === 'android') {
      setShowPicker(null);
    }
    if (selectedDate) {
      if (showPicker === 'from') {
        onFromChange(selectedDate);
      } else if (showPicker === 'to') {
        onToChange(selectedDate);
      }
    }
  };

  const handlePreset = (preset: DatePreset) => {
    onFromChange(preset.from);
    onToChange(preset.to);
  };

  const renderDateButton = (label: string, date: Date, type: 'from' | 'to') => (
    <TouchableOpacity
      style={styles.dateButton}
      onPress={() => setShowPicker(type)}
      activeOpacity={0.7}>
      <Text style={styles.dateLabel}>{label}</Text>
      <View style={styles.dateValueRow}>
        <Text style={styles.calendarIcon}>📅</Text>
        <Text style={styles.dateValue}>{dayjs(date).format('MMM D, YYYY')}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.dateRow}>
        {renderDateButton('From', fromDate, 'from')}
        <View style={styles.separator}>
          <Text style={styles.separatorText}>→</Text>
        </View>
        {renderDateButton('To', toDate, 'to')}
      </View>

      {presets.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.presetsRow}>
          {presets.map((preset, index) => (
            <TouchableOpacity
              key={index}
              style={styles.presetChip}
              onPress={() => handlePreset(preset)}>
              <Text style={styles.presetText}>{preset.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {showPicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={showPicker === 'from' ? fromDate : toDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}

      {showPicker && Platform.OS === 'ios' && (
        <Modal transparent animationType="slide">
          <View style={styles.iosOverlay}>
            <View style={styles.iosPickerContainer}>
              <View style={styles.iosPickerHeader}>
                <TouchableOpacity onPress={() => setShowPicker(null)}>
                  <Text style={styles.iosDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={showPicker === 'from' ? fromDate : toDate}
                mode="date"
                display="spinner"
                onChange={handleDateChange}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateButton: {
    flex: 1,
    backgroundColor: colors.neutral0,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm + 2,
    padding: spacing.xs + 4,
  },
  dateLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xxs,
  },
  dateValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calendarIcon: {
    ...typography.h4,
    marginRight: spacing.xxs + 2,
  },
  dateValue: {
    ...typography.bodySm,
    color: colors.textPrimary,
  },
  separator: {
    paddingHorizontal: spacing.xs,
    marginTop: spacing.md,
  },
  separatorText: {
    ...typography.h3,
    color: colors.textTertiary,
  },
  presetsRow: {
    marginTop: spacing.xs + 4,
  },
  presetChip: {
    paddingHorizontal: spacing.xs + 4,
    paddingVertical: spacing.xxs + 2,
    backgroundColor: colors.actionGreen + '12',
    borderRadius: 16,
    marginRight: spacing.xs,
  },
  presetText: {
    ...typography.caption,
    color: colors.actionGreen,
  },
  iosOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  iosPickerContainer: {
    backgroundColor: colors.neutral0,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  iosPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  iosDoneText: {
    ...typography.labelLg,
    color: colors.actionGreen,
  },
});

export default DateRangePicker;
