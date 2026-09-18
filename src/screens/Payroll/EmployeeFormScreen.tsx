import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { THEME } from '../../utils/theme';
import { getEmployeeByIdAPI, createEmployeeAPI, updateEmployeeAPI } from '../../networks/payroll/payrollNetwork';
import { employeeSingleSerializer } from '../../serializers/payrollSerializer';
import { validateEmployeePay } from '../../utils/payrollMath';
import CustomDropdown from '../../Custom-Components/CustomDropdown';
import CustomInput from '../../Custom-Components/CustomInput';
import CustomButton from '../../Custom-Components/CustomButton';
import { ReportContainer, ReportHeader, Card } from '../../components/reports/ReportUI';
import type { MoreStackParamList } from '../../navigators/stacks/MoreStack';

type Nav = NativeStackNavigationProp<MoreStackParamList>;
type Rt = RouteProp<Record<string, { employeeId?: string }>, string>;

const EmployeeFormScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const editingId = route.params?.employeeId;

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');
  const [payType, setPayType] = useState<'salary' | 'hourly'>('salary');
  const [salary, setSalary] = useState('0');
  const [hourlyRate, setHourlyRate] = useState('0');
  const [payFrequency, setPayFrequency] = useState('monthly');
  const [deduction, setDeduction] = useState('0');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editingId) return;
    getEmployeeByIdAPI(editingId).then(p => {
      const e = employeeSingleSerializer(p); if (!e) return;
      setFirstName(e.firstName); setLastName(e.lastName); setEmail(e.email); setDepartment(e.department);
      setPosition(e.position); setPayType(e.payType); setSalary(String(e.salary)); setHourlyRate(String(e.hourlyRate));
      setPayFrequency(e.payFrequency); setDeduction(String(e.deductionAmount));
    }).catch(() => {});
  }, [editingId]);

  const save = async () => {
    if (!firstName.trim() || !lastName.trim()) { Toast.show({ type: 'error', text1: 'Missing name', text2: 'First and last name are required.' }); return; }
    // The server takes a zero rate and a deduction bigger than the pay — the
    // latter posts negative net pay against Cash — so check both before saving.
    const payError = validateEmployeePay({
      payType,
      salary: parseFloat(salary) || 0,
      hourlyRate: parseFloat(hourlyRate) || 0,
      payFrequency,
      deduction,
    });
    if (payError) { Toast.show({ type: 'error', text1: 'Check the pay details', text2: payError }); return; }
    const payload: any = {
      firstName, lastName, email: email || undefined, department: department || undefined, position: position || undefined,
      payType, salary, hourlyRate, payFrequency, deductionAmount: deduction
    };
    setSaving(true);
    try {
      if (editingId) await updateEmployeeAPI(editingId, payload);
      else await createEmployeeAPI(payload);
      navigation.goBack();
    } catch (e: any) { Toast.show({ type: 'error', text1: 'Save failed', text2: e?.message ?? 'Could not save employee' }); }
    finally { setSaving(false); }
  };

  return (
    <ReportContainer>
      <ReportHeader title={editingId ? 'Edit Employee' : 'New Employee'} subtitle="Payroll profile" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card>
          <View style={styles.row}>
            <View style={styles.col}><CustomInput label="First Name" value={firstName} onChangeText={setFirstName} /></View>
            <View style={styles.col}><CustomInput label="Last Name" value={lastName} onChangeText={setLastName} /></View>
          </View>
          <CustomInput label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
          <View style={styles.row}>
            <View style={styles.col}><CustomInput label="Department" value={department} onChangeText={setDepartment} /></View>
            <View style={styles.col}><CustomInput label="Position" value={position} onChangeText={setPosition} /></View>
          </View>
        </Card>

        <Card>
          <CustomDropdown label="Pay Type" options={[{ label: 'Salary', value: 'salary' }, { label: 'Hourly', value: 'hourly' }]} value={payType} onChange={v => setPayType(v as any)} />
          {payType === 'salary'
            ? <CustomInput label="Annual Salary" value={salary} onChangeText={setSalary} keyboardType="numeric" />
            : <CustomInput label="Hourly Rate" value={hourlyRate} onChangeText={setHourlyRate} keyboardType="numeric" />}
          <CustomDropdown label="Pay Frequency" options={[{ label: 'Weekly', value: 'weekly' }, { label: 'Bi-weekly', value: 'biweekly' }, { label: 'Monthly', value: 'monthly' }]} value={payFrequency} onChange={setPayFrequency} />
          <CustomInput label="Deduction / Tax per period" value={deduction} onChangeText={setDeduction} keyboardType="numeric" />
        </Card>

        <CustomButton title={editingId ? 'Update Employee' : 'Add Employee'} onPress={save} isLoading={saving} fullWidth />
        <View style={{ height: 24 }} />
      </ScrollView>
    </ReportContainer>
  );
};

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14 },
  row: { flexDirection: 'row', gap: 12 },
  col: { flex: 1 }
});

export default EmployeeFormScreen;
