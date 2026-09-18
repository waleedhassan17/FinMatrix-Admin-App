import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  StyleSheet,
  Modal,
} from 'react-native';
import { colors, spacing, borderRadius, shadows } from '../theme';
import { THEME } from '../utils/theme';

interface DropdownOption {
  label: string;
  value: string;
}

interface CustomDropdownProps {
  label: string;
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  searchable?: boolean;
  /** Read-only: shows the selection but will not open the picker. Mirrors
   *  CustomInput's `disabled`, including its muted styling. */
  disabled?: boolean;
}

const CustomDropdown: React.FC<CustomDropdownProps> = ({
  label,
  options,
  value,
  onChange,
  placeholder = 'Select...',
  error,
  searchable = false,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedOption = options.find(opt => opt.value === value);

  const filteredOptions = searchable
    ? options.filter(opt =>
        opt.label.toLowerCase().includes(search.toLowerCase()),
      )
    : options;

  const handleSelect = useCallback(
    (optionValue: string) => {
      onChange(optionValue);
      setIsOpen(false);
      setSearch('');
    },
    [onChange],
  );

  const getBorderColor = () => {
    if (error) return colors.danger;
    // Matches CustomInput: an open control signals with the ACTION colour, not
    // the violet category colour.
    if (isOpen) return colors.primary;
    return colors.border;
  };

  const renderItem = ({ item }: { item: DropdownOption }) => (
    <TouchableOpacity
      style={[styles.option, item.value === value && styles.optionSelected]}
      onPress={() => handleSelect(item.value)}>
      <Text
        style={[
          styles.optionText,
          item.value === value && styles.optionTextSelected,
        ]}>
        {item.label}
      </Text>
      {item.value === value && <Text style={styles.checkmark}>✓</Text>}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={[styles.label, error && styles.labelError]}>{label}</Text>
      <TouchableOpacity
        style={[
          styles.field,
          { borderColor: getBorderColor() },
          disabled && styles.fieldDisabled,
        ]}
        onPress={() => setIsOpen(true)}
        disabled={disabled}
        activeOpacity={0.7}>
        <Text
          style={[
            styles.fieldText,
            !selectedOption && styles.placeholderText,
            disabled && styles.fieldTextDisabled,
          ]}>
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        {/* No chevron when disabled: it advertises a picker that will not open. */}
        {!disabled && <Text style={styles.chevron}>▾</Text>}
      </TouchableOpacity>
      {error && <Text style={styles.errorText}>{error}</Text>}

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}>
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setIsOpen(false)}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setIsOpen(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            {searchable && (
              <TextInput
                style={styles.searchInput}
                placeholder="Search..."
                placeholderTextColor={colors.textLight}
                value={search}
                onChangeText={setSearch}
                autoFocus
              />
            )}
            <FlatList
              data={filteredOptions}
              keyExtractor={item => item.value}
              renderItem={renderItem}
              style={styles.list}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No options found</Text>
              }
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    ...THEME.typography.bodyMd,
    fontWeight: THEME.typography.labelSm.fontWeight,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  labelError: {
    color: colors.danger,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderRadius: borderRadius.sm + 2,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.sm + 4,
  },
  // Matches CustomInput's inputDisabled / textDisabled, so a read-only form
  // reads the same whichever control it is built from.
  fieldDisabled: {
    backgroundColor: colors.background,
    opacity: 0.7,
  },
  fieldText: {
    ...THEME.typography.bodyLg,
    flex: 1,
    color: colors.textPrimary,
  },
  fieldTextDisabled: {
    color: colors.textLight,
  },
  placeholderText: {
    color: colors.textLight,
  },
  chevron: {
    fontSize: THEME.typography.h4.fontSize,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  errorText: {
    ...THEME.typography.caption,
    color: colors.danger,
    marginTop: spacing.xs,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modal: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    maxHeight: '70%',
    ...shadows.large,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...THEME.typography.h3,
    color: colors.textPrimary,
  },
  closeBtn: {
    fontSize: THEME.typography.h2.fontSize,
    color: colors.textSecondary,
    padding: spacing.xs,
  },
  searchInput: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    margin: spacing.md,
    paddingHorizontal: spacing.sm + 4,
    ...THEME.typography.bodyLg,
    color: colors.textPrimary,
  },
  list: {
    paddingBottom: spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionSelected: {
    backgroundColor: colors.primary + '10',
  },
  optionText: {
    ...THEME.typography.bodyLg,
    flex: 1,
    color: colors.textPrimary,
  },
  optionTextSelected: {
    color: colors.primary,
    fontWeight: THEME.typography.labelMd.fontWeight,
  },
  checkmark: {
    ...THEME.typography.h3,
    fontWeight: THEME.typography.labelMd.fontWeight,
    color: colors.primary,
  },
  emptyText: {
    ...THEME.typography.bodyLg,
    textAlign: 'center',
    padding: spacing.lg,
    color: colors.textLight,
  },
});

export default CustomDropdown;
