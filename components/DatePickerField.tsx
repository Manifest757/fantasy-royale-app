import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, Platform, Modal, StyleSheet, ScrollView, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

interface DatePickerFieldProps {
  value: string;
  onChange: (dateStr: string) => void;
  placeholder?: string;
  format?: 'date' | 'datetime';
  backgroundColor?: string;
  textColor?: string;
  placeholderColor?: string;
  fontSize?: number;
  minDate?: string;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseLocalDate(val: string): Date {
  if (!val) return new Date();
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    return new Date(val + 'T00:00:00');
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
}

function TimeDropdown({ value, max, min = 0, step = 1, onChange, label }: {
  value: number;
  max: number;
  min?: number;
  step?: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const options: number[] = [];
  for (let i = min; i <= max; i += step) options.push(i);

  if (!open) {
    return (
      <Pressable
        onPress={() => setOpen(true)}
        style={{ backgroundColor: '#2a2a2a', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: '#555', minWidth: 60, alignItems: 'center' }}
      >
        <Text style={{ color: '#888', fontSize: 10, marginBottom: 2 }}>{label}</Text>
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>{String(value).padStart(2, '0')}</Text>
      </Pressable>
    );
  }

  return (
    <View style={{ backgroundColor: '#2a2a2a', borderRadius: 8, borderWidth: 1, borderColor: '#22d3ee', minWidth: 60, maxHeight: 160, overflow: 'hidden' }}>
      <Text style={{ color: '#22d3ee', fontSize: 10, textAlign: 'center', paddingTop: 4 }}>{label}</Text>
      <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 140 }}>
        {options.map(n => (
          <Pressable
            key={n}
            onPress={() => { onChange(n); setOpen(false); }}
            style={{ paddingVertical: 6, paddingHorizontal: 12, backgroundColor: n === value ? '#22d3ee' : 'transparent', alignItems: 'center' }}
          >
            <Text style={{ color: n === value ? '#000' : '#fff', fontSize: 15, fontWeight: n === value ? '700' : '400' }}>
              {String(n).padStart(2, '0')}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function WebCalendar({ value, onChange, format, onClose, backgroundColor, textColor, minDate }: {
  value: string;
  onChange: (dateStr: string) => void;
  format: 'date' | 'datetime';
  onClose: () => void;
  backgroundColor: string;
  textColor: string;
  minDate?: string;
}) {
  const initial = value ? parseLocalDate(value) : new Date();
  const [viewDate, setViewDate] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(initial);
  const initH = initial.getHours();
  const [hours12, setHours12] = useState(String(initH === 0 ? 12 : initH > 12 ? initH - 12 : initH));
  const [minutes, setMinutes] = useState(String(initial.getMinutes()).padStart(2, '0'));
  const [ampm, setAmpm] = useState<'AM' | 'PM'>(initH >= 12 ? 'PM' : 'AM');

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const minDateObj = minDate ? new Date(minDate + 'T00:00:00') : null;

  const isDayDisabled = (day: number): boolean => {
    if (!minDateObj) return false;
    const d = new Date(year, month, day);
    return d < minDateObj;
  };

  const isPrevMonthDisabled = (): boolean => {
    if (!minDateObj) return false;
    const lastDayOfPrevMonth = new Date(year, month, 0);
    return lastDayOfPrevMonth < minDateObj;
  };

  const prevMonth = () => { if (!isPrevMonthDisabled()) setViewDate(new Date(year, month - 1, 1)); };
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const isSelected = (day: number) => {
    return selectedDate.getFullYear() === year && selectedDate.getMonth() === month && selectedDate.getDate() === day;
  };

  const isToday = (day: number) => {
    const today = new Date();
    return today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
  };

  const handleDayClick = (day: number) => {
    if (isDayDisabled(day)) return;
    const newDate = new Date(year, month, day, selectedDate.getHours(), selectedDate.getMinutes());
    setSelectedDate(newDate);
  };

  const handleConfirm = () => {
    let h = parseInt(hours12) || 12;
    if (ampm === 'AM') {
      if (h === 12) h = 0;
    } else {
      if (h !== 12) h += 12;
    }
    const m = parseInt(minutes) || 0;
    const final = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), h, m);
    const y = final.getFullYear();
    const mo = String(final.getMonth() + 1).padStart(2, '0');
    const d = String(final.getDate()).padStart(2, '0');
    if (format === 'datetime') {
      const hh = String(final.getHours()).padStart(2, '0');
      const mm = String(final.getMinutes()).padStart(2, '0');
      onChange(`${y}-${mo}-${d}T${hh}:${mm}`);
    } else {
      onChange(`${y}-${mo}-${d}`);
    }
    onClose();
  };

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  while (weeks.length > 0 && weeks[weeks.length - 1].length < 7) {
    weeks[weeks.length - 1].push(null);
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }}>
        <Pressable onPress={(e) => e.stopPropagation()} style={{ backgroundColor: '#1c1c1e', borderRadius: 16, padding: 20, width: 320, maxWidth: '90%' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Pressable onPress={prevMonth} style={{ padding: 4, opacity: isPrevMonthDisabled() ? 0.3 : 1 }}>
              <Text style={{ color: '#22d3ee', fontSize: 20 }}>‹</Text>
            </Pressable>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{MONTH_NAMES[month]} {year}</Text>
            <Pressable onPress={nextMonth} style={{ padding: 4 }}>
              <Text style={{ color: '#22d3ee', fontSize: 20 }}>›</Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', marginBottom: 8 }}>
            {DAY_NAMES.map(d => (
              <View key={d} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
                <Text style={{ color: '#888', fontSize: 11, fontWeight: '600' }}>{d}</Text>
              </View>
            ))}
          </View>

          {weeks.map((week, wi) => (
            <View key={wi} style={{ flexDirection: 'row' }}>
              {week.map((day, di) => (
                <View key={di} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
                  {day ? (
                    <Pressable
                      onPress={() => handleDayClick(day)}
                      disabled={isDayDisabled(day)}
                      style={{
                        width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center',
                        backgroundColor: isSelected(day) && !isDayDisabled(day) ? '#22d3ee' : isToday(day) ? 'rgba(34,211,238,0.15)' : 'transparent',
                      }}
                    >
                      <Text style={{ color: isDayDisabled(day) ? '#444' : isSelected(day) ? '#000' : '#fff', fontSize: 13, fontWeight: isSelected(day) && !isDayDisabled(day) ? '700' : '400' }}>{day}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          ))}

          {format === 'datetime' && (
            <View style={{ marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#333' }}>
              <Text style={{ color: '#888', fontSize: 13, textAlign: 'center', marginBottom: 8 }}>Time</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <TimeDropdown
                  value={parseInt(hours12)}
                  max={12}
                  min={1}
                  onChange={(v) => setHours12(String(v))}
                  label="Hour"
                />
                <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', marginHorizontal: 2 }}>:</Text>
                <TimeDropdown
                  value={parseInt(minutes)}
                  max={59}
                  step={5}
                  onChange={(v) => setMinutes(String(v).padStart(2, '0'))}
                  label="Min"
                />
                <View style={{ marginLeft: 6 }}>
                  <Pressable
                    onPress={() => setAmpm('AM')}
                    style={{ backgroundColor: ampm === 'AM' ? '#22d3ee' : '#2a2a2a', borderTopLeftRadius: 8, borderTopRightRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: ampm === 'AM' ? '#22d3ee' : '#555' }}
                  >
                    <Text style={{ color: ampm === 'AM' ? '#000' : '#fff', fontSize: 13, fontWeight: ampm === 'AM' ? '700' : '400' }}>AM</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setAmpm('PM')}
                    style={{ backgroundColor: ampm === 'PM' ? '#22d3ee' : '#2a2a2a', borderBottomLeftRadius: 8, borderBottomRightRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderTopWidth: 0, borderColor: ampm === 'PM' ? '#22d3ee' : '#555' }}
                  >
                    <Text style={{ color: ampm === 'PM' ? '#000' : '#fff', fontSize: 13, fontWeight: ampm === 'PM' ? '700' : '400' }}>PM</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, gap: 12 }}>
            <Pressable onPress={onClose} style={{ flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#444', alignItems: 'center' }}>
              <Text style={{ color: '#ff453a', fontSize: 14 }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleConfirm} style={{ flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#22d3ee', alignItems: 'center' }}>
              <Text style={{ color: '#000', fontSize: 14, fontWeight: '600' }}>Confirm</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function DatePickerField({
  value,
  onChange,
  placeholder = 'Select date',
  format = 'date',
  backgroundColor = '#2a2a2a',
  textColor = '#fff',
  placeholderColor = '#888',
  fontSize = 12,
  minDate,
}: DatePickerFieldProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());

  const parseCurrentValue = (): Date => {
    return parseLocalDate(value || '');
  };

  const formatOutput = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    if (format === 'datetime') {
      const h = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${y}-${m}-${day}T${h}:${min}`;
    }
    return `${y}-${m}-${day}`;
  };

  const displayValue = (): string => {
    if (!value) return '';
    const d = parseLocalDate(value);
    if (isNaN(d.getTime())) return value;
    if (format === 'datetime') {
      return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const handleOpen = () => {
    setTempDate(parseCurrentValue());
    setShowPicker(true);
  };

  if (Platform.OS === 'web') {
    return (
      <View>
        <Pressable onPress={handleOpen} style={[pickerStyles.field, { backgroundColor, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
          <Ionicons name="calendar-outline" size={16} color={value ? textColor : placeholderColor} />
          <Text style={{ color: value ? textColor : placeholderColor, fontSize, flex: 1 }}>
            {value ? displayValue() : placeholder}
          </Text>
        </Pressable>
        {showPicker && (
          <WebCalendar
            value={value}
            onChange={onChange}
            format={format || 'date'}
            onClose={() => setShowPicker(false)}
            backgroundColor={backgroundColor}
            textColor={textColor}
            minDate={minDate}
          />
        )}
      </View>
    );
  }

  return (
    <View>
      <Pressable onPress={handleOpen} style={[pickerStyles.field, { backgroundColor, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
        <Ionicons name="calendar-outline" size={16} color={value ? textColor : placeholderColor} />
        <Text style={{ color: value ? textColor : placeholderColor, fontSize }}>
          {value ? displayValue() : placeholder}
        </Text>
      </Pressable>

      {showPicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={tempDate}
          mode={format === 'datetime' ? 'date' : 'date'}
          display="default"
          minimumDate={minDate ? new Date(minDate + 'T00:00:00') : undefined}
          onChange={(event, selectedDate) => {
            if (event.type === 'dismissed') {
              setShowPicker(false);
              return;
            }
            if (selectedDate) {
              if (format === 'datetime') {
                setTempDate(selectedDate);
                setShowPicker(false);
                setTimeout(() => setShowPicker(true), 100);
              } else {
                onChange(formatOutput(selectedDate));
                setShowPicker(false);
              }
            }
          }}
        />
      )}

      {showPicker && Platform.OS === 'ios' && (
        <Modal transparent animationType="slide">
          <View style={pickerStyles.modalOverlay}>
            <View style={pickerStyles.modalContent}>
              <View style={pickerStyles.modalHeader}>
                <Pressable onPress={() => setShowPicker(false)}>
                  <Text style={pickerStyles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable onPress={() => {
                  onChange(formatOutput(tempDate));
                  setShowPicker(false);
                }}>
                  <Text style={pickerStyles.doneText}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={tempDate}
                mode={format === 'datetime' ? 'datetime' : 'date'}
                display="spinner"
                minimumDate={minDate ? new Date(minDate + 'T00:00:00') : undefined}
                onChange={(_, selectedDate) => {
                  if (selectedDate) setTempDate(selectedDate);
                }}
                style={{ height: 200 }}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const pickerStyles = StyleSheet.create({
  field: {
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 38,
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#333',
  },
  cancelText: {
    color: '#ff453a',
    fontSize: 16,
  },
  doneText: {
    color: '#0a84ff',
    fontSize: 16,
    fontWeight: '600',
  },
});
