import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  LayoutAnimation
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { v4 as uuidv4 } from 'uuid';
import CustomButton from '../../../Custom-Components/CustomButton';
import {
  AuthLayout,
  AuthHeader,
  AuthFooterBar,
  AuthField,
  AuthSelect,
  AuthSectionLabel,
  AuthNotice,
  AUTH
} from '../../../components/auth/AuthUI';
import { THEME } from '../../../utils/theme';
import { isValidPkPhone, normalizePkPhone, PK_PHONE_MESSAGE } from '../../../utils/phone';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import {
  createCompany,
  type CompanyData,
  type CompanyMember
} from '../companySlice';
import { setUser } from '../authSlice';
import {
  setDraftField,
  clearCompanyDraft,
  selectCompanyDraft,
  selectDraftOwnerId,
  type CompanyDraftField
} from './createCompanySlice';
import {
  warehouseAgencies,
  type WarehouseAgency
} from '../../../models/agencyModel';
import { dummyDeliveryPersonnel } from '../../../models/deliveryModel';
import { setStoredCompanyId } from '../../../utils/storageUtils';
import { createCompanyAPI } from '../../../networks/auth/authNetwork';
import type { RootStackParamList } from '../../../types';

// Design-system tokens (see src/theme/theme.ts).
const { typography } = THEME;

type Props = NativeStackScreenProps<RootStackParamList, 'CreateCompany'>;

// ═══════════════════════════════════════════════════════
// Design System — matches auth flow screens
// ═══════════════════════════════════════════════════════
const DS = {
  navy900: THEME.colors.neutral900,
  navy800: THEME.colors.neutral900,
  navy700: THEME.colors.neutral800,

  green500: THEME.colors.actionGreen,
  green400: THEME.colors.actionGreenDark,
  green300: THEME.colors.success,
  green50: THEME.colors.actionGreenLighter,
  greenBorder: THEME.colors.successLight,

  blue600: THEME.colors.info,
  blue500: THEME.colors.info,
  blue100: THEME.colors.infoLight,
  blue50: THEME.colors.background,

  slate50: THEME.colors.neutral50,
  slate100: THEME.colors.background,
  slate200: THEME.colors.neutral200,
  slate300: THEME.colors.neutral300,
  slate400: THEME.colors.neutral400,
  slate500: THEME.colors.neutral500,

  red50: THEME.colors.dangerLighter,
  red100: THEME.colors.dangerLight,
  red500: THEME.colors.danger,
  red700: THEME.colors.dangerHover,
  red900: THEME.colors.dangerHover,

  amber50: THEME.colors.warningLighter,
  amber600: THEME.colors.warning,
  amber800: THEME.colors.warningHover,
  amberBorder: THEME.colors.warningLight,

  white: THEME.colors.neutral0,

  radius: { sm: 8, md: 12, lg: 16, xl: 20, full: 9999 },

  shadowSm: {
    shadowColor: THEME.colors.neutral900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },
  shadowMd: {
    shadowColor: THEME.colors.neutral900,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4
  },
  shadowLg: {
    shadowColor: THEME.colors.neutral900,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8
  },
};

const INDUSTRIES = [
  { label: 'Manufacturing', value: 'Manufacturing' },
  { label: 'Supply Chain', value: 'Supply Chain' },
  { label: 'Distribution', value: 'Distribution' },
  { label: 'Retail', value: 'Retail' },
  { label: 'Services', value: 'Services' },
  { label: 'Other', value: 'Other' },
];

// Matches backend LEGAL_STRUCTURES.
const BUSINESS_STRUCTURES = [
  { label: 'Sole Proprietor', value: 'sole_proprietor' },
  { label: 'LLC', value: 'llc' },
  { label: 'Partnership', value: 'partnership' },
  { label: 'Corporation', value: 'corporation' },
];

const COUNTRIES = [
  { label: 'Pakistan', value: 'Pakistan' },
  { label: 'UAE', value: 'UAE' },
  { label: 'Saudi Arabia', value: 'Saudi Arabia' },
  { label: 'Other', value: 'Other' },
];

const generateInviteCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const STEPS: { label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'Details', icon: 'business-outline' },
  { label: 'Agencies', icon: 'layers-outline' },
  { label: 'Review', icon: 'checkmark-circle-outline' },
];

// ═══════════════════════════════════════════════════════
// Step Header Configs
// ═══════════════════════════════════════════════════════
const STEP_HEADERS: {
  title: string;
  subtitle: string;
}[] = [
  {
    title: 'Company Details',
    subtitle: 'Enter your business information to get started'
  },
  {
    title: 'Warehouse Agencies',
    subtitle: 'Select agencies whose inventory you want to manage'
  },
  {
    title: 'Review & Create',
    subtitle: 'Confirm your details and launch your workspace'
  },
];

// ═══════════════════════════════════════════════════════
// Screen
// ═══════════════════════════════════════════════════════
const CreateCompanyScreen: React.FC<Props> = ({ navigation, route }) => {
  // Three-tier model: chosen on the type-select step; rides into the create
  // payload and on to plan selection (which shows only this type's plans).
  const companyType = route.params?.companyType;
  const dispatch = useAppDispatch();
  const user = useAppSelector(state => state.auth.user);

  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── Step 1 fields live in a PERSISTED slice, not local state ──
  // The company row does not exist until submit, so anything typed here is
  // lost on a reload or a token expiry unless it is stored. See
  // createCompanySlice: the draft is keyed by user and cleared once the
  // company is created.
  const draft = useAppSelector(selectCompanyDraft);
  const draftOwnerId = useAppSelector(selectDraftOwnerId);
  const userId = user?.uid ?? null;

  // A draft belongs to whoever typed it. If a different account signs in on
  // this device, drop it rather than showing them someone else's details.
  useEffect(() => {
    if (draftOwnerId && userId && draftOwnerId !== userId) {
      dispatch(clearCompanyDraft());
    }
  }, [draftOwnerId, userId, dispatch]);

  const setField = useCallback(
    (field: CompanyDraftField, value: string) => {
      dispatch(setDraftField({ field, value, userId }));
    },
    [dispatch, userId],
  );

  const {
    companyName, industry, legalStructure, street, city, stateProv,
    zipCode, country, phone, email, website, taxId
  } = draft;

  const setCompanyName = (v: string) => setField('companyName', v);
  const setIndustry = (v: string) => setField('industry', v);
  const setLegalStructure = (v: string) => setField('legalStructure', v);
  const setStreet = (v: string) => setField('street', v);
  const setCity = (v: string) => setField('city', v);
  const setStateProv = (v: string) => setField('stateProv', v);
  const setZipCode = (v: string) => setField('zipCode', v);
  const setCountry = (v: string) => setField('country', v);
  const setPhone = (v: string) => setField('phone', v);
  const setEmail = (v: string) => setField('email', v);
  const setWebsite = (v: string) => setField('website', v);
  const setTaxId = (v: string) => setField('taxId', v);

  // Step 2 fields
  const [selectedAgencyIds, setSelectedAgencyIds] = useState<string[]>([]);
  const [expandedAgencyId, setExpandedAgencyId] = useState<string | null>(null);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customAgencies, setCustomAgencies] = useState<WarehouseAgency[]>([]);
  const [customAgency, setCustomAgency] = useState({
    name: '',
    type: '',
    description: '',
    address: '',
    contact: ''
  });

  // Step 3
  const [inviteCode] = useState(generateInviteCode());
  const [isCreating, setIsCreating] = useState(false);

  // Server-side failures render in the card's error banner, never a browser
  // dialog. scrollRef brings the banner into view when it appears.
  const [submitError, setSubmitError] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const validateStep1 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!companyName.trim()) errs.companyName = 'Company name is required';
    if (!street.trim()) errs.street = 'Street address is required';
    if (!city.trim()) errs.city = 'City is required';
    if (!stateProv.trim()) errs.state = 'State/Province is required';
    if (!zipCode.trim()) errs.zipCode = 'ZIP code is required';
    // Company phones are legitimately landlines (042 35761234) as well as
    // mobiles, and any spacing/dashes are fine — normalizePkPhone canonicalises
    // before we send.
    if (!phone.trim()) errs.phone = 'Phone is required';
    else if (!isValidPkPhone(phone)) errs.phone = PK_PHONE_MESSAGE;
    if (!email.trim()) errs.email = 'Email is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = (): boolean => {
    if (selectedAgencyIds.length === 0) {
      setErrors({ agencies: 'Select at least one agency' });
      return false;
    }
    setErrors({});
    return true;
  };

  const handleNext = () => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
    } else if (currentStep === 2 && validateStep2()) {
      setCurrentStep(3);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setErrors({});
    } else {
      navigation.goBack();
    }
  };

  const toggleAgency = (agencyId: string) => {
    setSelectedAgencyIds(prev =>
      prev.includes(agencyId)
        ? prev.filter(id => id !== agencyId)
        : [...prev, agencyId],
    );
    if (errors.agencies) setErrors({});
  };

  const toggleExpandAgency = (agencyId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedAgencyId(prev => (prev === agencyId ? null : agencyId));
  };

  const addCustomAgency = () => {
    if (!customAgency.name.trim()) {
      // In-form, consistent with every other validation message on this screen.
      setErrors(prev => ({ ...prev, customAgencyName: 'Agency name is required' }));
      return;
    }
    const newAgency: WarehouseAgency = {
      id: `custom_${uuidv4().slice(0, 8)}`,
      name: customAgency.name,
      type: (customAgency.type as any) || 'Distribution',
      typeBadgeColor: THEME.colors.warning,
      description: customAgency.description || 'Custom agency',
      productCount: 0,
      city: '',
      province: '',
      address: customAgency.address,
      contactPhone: customAgency.contact,
      contactEmail: '',
      inventory: []
    };
    setCustomAgencies(prev => [...prev, newAgency]);
    setSelectedAgencyIds(prev => [...prev, newAgency.id]);
    setShowCustomForm(false);
    setCustomAgency({
      name: '',
      type: '',
      description: '',
      address: '',
      contact: ''
    });
  };

  const allAgencies = [...warehouseAgencies, ...customAgencies];
  const selectedAgencies = allAgencies.filter(a =>
    selectedAgencyIds.includes(a.id),
  );
  const totalItems = selectedAgencies.reduce(
    (sum, a) => sum + a.inventory.length,
    0,
  );

  const handleCreate = useCallback(async () => {
    if (!user || isCreating) return;
    setIsCreating(true);

    try {
      // Create company on backend first to get the real company ID
      const backendCompany = await createCompanyAPI({
        name: companyName.trim(),
        industry,
        companyType,
        legalStructure: legalStructure || undefined,
        address: {
          street: street.trim(),
          city: city.trim(),
          state: stateProv.trim(),
          postalCode: zipCode.trim(),
          country,
        },
        // Canonical +92XXXXXXXXXX — the server stores this shape.
        phone: normalizePkPhone(phone),
        email: email.trim(),
        taxId: taxId.trim()
      });

      const companyId: string = backendCompany?.id ?? backendCompany?.companyId ?? `company_${uuidv4().slice(0, 8)}`;
      await setStoredCompanyId(companyId);

      // Company is created as an onboarding draft (status: email_verified);
      // it becomes pending_approval once a plan is chosen & submitted.
      dispatch(
        setUser({
          ...user,
          companyId,
          companyStatus: backendCompany?.status ?? 'email_verified'
        }),
      );

      const now = new Date().toISOString();
      const adminMember: CompanyMember = {
        userId: user.uid,
        role: 'admin',
        displayName: user.displayName,
        email: user.email,
        phone: user.phoneNumber,
        joinedAt: now
      };

      const companyData: CompanyData = {
        companyId,
        name: companyName.trim(),
        industry,
        address: street.trim(),
        city: city.trim(),
        state: stateProv.trim(),
        zipCode: zipCode.trim(),
        country,
        phone: phone.trim(),
        email: email.trim(),
        website: website.trim(),
        taxId: taxId.trim(),
        logo: null,
        inviteCode,
        agencies: selectedAgencies,
        members: [adminMember],
        deliveryPersonnel: [
          ...dummyDeliveryPersonnel.map(dp => ({ ...dp, companyId })),
        ],
        createdAt: now
      };

      // The company row now exists — the local draft has served its purpose.
      dispatch(clearCompanyDraft());
      dispatch(createCompany(companyData));
      setIsCreating(false);
      navigation.navigate('SubscriptionSelect', { companyId, companyType });
    } catch (err: any) {
      setIsCreating(false);
      // In-form banner, not a browser dialog — and scrolled into view so it
      // can't be missed on a long form.
      setSubmitError(err?.message ?? 'Unable to create company. Please try again.');
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  }, [
    user,
    isCreating,
    companyName,
    industry,
    legalStructure,
    street,
    city,
    stateProv,
    zipCode,
    country,
    phone,
    email,
    website,
    taxId,
    inviteCode,
    selectedAgencies,
    dispatch,
    navigation,
  ]);

  // Minimal single-step signup (QuickBooks-style): validate the company details
  // and create immediately — no warehouse/agency step during onboarding (that
  // feature lives under More → Agencies).
  const handleSubmit = () => {
    setSubmitError('');
    if (validateStep1()) handleCreate();
  };

  const stepCfg = STEP_HEADERS[0];
  const progressWidth = '100%'; // single-step form (kept for shared render helpers)

  // ────────────────────────────────────────
  // Step Indicator (below header, inside card zone)
  // ────────────────────────────────────────
  const renderStepIndicator = () => (
    <View style={s.stepIndicator}>
      {STEPS.map((step, i) => {
        const stepNum = i + 1;
        const isActive = currentStep === stepNum;
        const isDone = currentStep > stepNum;
        return (
          <React.Fragment key={step.label}>
            {i > 0 && (
              <View
                style={[
                  s.stepConnector,
                  isDone && s.stepConnectorDone,
                ]}
              />
            )}
            <View style={s.stepNode}>
              <View
                style={[
                  s.stepCircle,
                  isActive && s.stepCircleActive,
                  isDone && s.stepCircleDone,
                ]}>
                {isDone ? (
                  <Ionicons name="checkmark" size={14} color={DS.white} />
                ) : (
                  <Ionicons
                    name={step.icon}
                    size={14}
                    color={isActive ? DS.white : DS.slate400}
                  />
                )}
              </View>
              <Text
                style={[
                  s.stepLabel,
                  isActive && s.stepLabelActive,
                  isDone && s.stepLabelDone,
                ]}>
                {step.label}
              </Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );

  // ────────────────────────────────────────
  // Progress Track
  // ────────────────────────────────────────
  const renderProgressTrack = () => (
    <View style={s.progressTrackWrap}>
      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: progressWidth }]} />
      </View>
      <Text style={s.progressLabel}>
        Step {currentStep} of {STEPS.length}
      </Text>
    </View>
  );

  // ────────────────────────────────────────
  // Agency Card
  // ────────────────────────────────────────
  const renderAgencyCard = (agency: WarehouseAgency) => {
    const isSelected = selectedAgencyIds.includes(agency.id);
    const isExpanded = expandedAgencyId === agency.id;

    return (
      <View
        key={agency.id}
        style={[s.agencyCard, isSelected && s.agencyCardSelected]}>
        <TouchableOpacity
          style={s.agencyCardHeader}
          onPress={() => toggleAgency(agency.id)}
          activeOpacity={0.7}>
          {/* Checkbox */}
          <View style={s.agencyCheckbox}>
            {isSelected ? (
              <View style={s.checkboxChecked}>
                <Ionicons name="checkmark" size={14} color={DS.white} />
              </View>
            ) : (
              <View style={s.checkboxUnchecked} />
            )}
          </View>

          {/* Info */}
          <View style={s.agencyInfo}>
            <View style={s.agencyNameRow}>
              <Text style={s.agencyName}>{agency.name}</Text>
              <View
                style={[
                  s.typeBadge,
                  { backgroundColor: agency.typeBadgeColor + '14' },
                ]}>
                <View
                  style={[
                    s.typeBadgeDot,
                    { backgroundColor: agency.typeBadgeColor },
                  ]}
                />
                <Text
                  style={[
                    s.typeBadgeText,
                    { color: agency.typeBadgeColor },
                  ]}>
                  {agency.type}
                </Text>
              </View>
            </View>
            <Text style={s.agencyDesc} numberOfLines={2}>
              {agency.description}
            </Text>
            <View style={s.agencyMeta}>
              <View style={s.agencyMetaChip}>
                <Ionicons
                  name="cube-outline"
                  size={12}
                  color={DS.slate500}
                />
                <Text style={s.agencyMetaText}>
                  {agency.inventory.length} products
                </Text>
              </View>
              <View style={s.agencyMetaChip}>
                <Ionicons
                  name="location-outline"
                  size={12}
                  color={DS.slate500}
                />
                <Text style={s.agencyMetaText}>
                  {agency.city}, {agency.province}
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* Expand toggle */}
        <TouchableOpacity
          style={s.expandButton}
          onPress={() => toggleExpandAgency(agency.id)}
          activeOpacity={0.7}>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={DS.blue600}
            style={{ marginRight: 6 }}
          />
          <Text style={s.expandText}>
            {isExpanded ? 'Hide Items' : 'Preview Items'}
          </Text>
        </TouchableOpacity>

        {/* Inventory preview */}
        {isExpanded && (
          <View style={s.inventoryPreview}>
            {agency.inventory.map((item, idx) => (
              <View
                key={item.id}
                style={[
                  s.inventoryRow,
                  idx === agency.inventory.length - 1 && {
                    borderBottomWidth: 0,
                  },
                ]}>
                <View style={s.inventoryDot} />
                <Text style={s.inventoryItemName}>{item.name}</Text>
                <Text style={s.inventoryItemPrice}>
                  Rs {item.sellingPrice.toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  // ────────────────────────────────────────
  // Step 1 — Company Info
  // ────────────────────────────────────────
  const renderStep1 = () => (
    <View style={s.stepBody}>
      <AuthField
        label="Company Name *"
        value={companyName}
        onChangeText={(t: string) => {
          setCompanyName(t);
          if (errors.companyName)
            setErrors(p => ({ ...p, companyName: '' }));
        }}
        placeholder="Enter company name"
        error={errors.companyName}
      />

      <AuthSelect
        label="Industry"
        options={INDUSTRIES}
        value={industry}
        onChange={setIndustry}
        placeholder="Select industry"
      />

      <AuthSelect
        label="Business Structure"
        options={BUSINESS_STRUCTURES}
        value={legalStructure}
        onChange={setLegalStructure}
        placeholder="Select business structure"
      />

      <AuthSectionLabel>Address</AuthSectionLabel>

      <AuthField
        label="Street *"
        value={street}
        onChangeText={(t: string) => {
          setStreet(t);
          if (errors.street) setErrors(p => ({ ...p, street: '' }));
        }}
        placeholder="Street address"
        error={errors.street}
      />

      <View style={s.row}>
        <View style={s.halfInput}>
          <AuthField
            label="City *"
            value={city}
            onChangeText={(t: string) => {
              setCity(t);
              if (errors.city) setErrors(p => ({ ...p, city: '' }));
            }}
            placeholder="City"
            error={errors.city}
          />
        </View>
        <View style={s.halfInput}>
          <AuthField
            label="State/Province *"
            value={stateProv}
            onChangeText={(t: string) => {
              setStateProv(t);
              if (errors.state) setErrors(p => ({ ...p, state: '' }));
            }}
            placeholder="State"
            error={errors.state}
          />
        </View>
      </View>

      <View style={s.row}>
        <View style={s.halfInput}>
          <AuthField
            label="ZIP Code *"
            value={zipCode}
            onChangeText={(t: string) => {
              setZipCode(t);
              if (errors.zipCode)
                setErrors(p => ({ ...p, zipCode: '' }));
            }}
            placeholder="ZIP"
            keyboardType="number-pad"
            error={errors.zipCode}
          />
        </View>
        <View style={s.halfInput}>
          <AuthSelect
            label="Country"
            options={COUNTRIES}
            value={country}
            onChange={setCountry}
          />
        </View>
      </View>

      <AuthSectionLabel>Contact</AuthSectionLabel>

      <AuthField
        label="Phone *"
        value={phone}
        onChangeText={(t: string) => {
          setPhone(t);
          if (errors.phone) setErrors(p => ({ ...p, phone: '' }));
        }}
        placeholder="0312 3456789 or 042 35761234"
        keyboardType="phone-pad"
        error={errors.phone}
      />
      <AuthField
        label="Email *"
        value={email}
        onChangeText={(t: string) => {
          setEmail(t);
          if (errors.email) setErrors(p => ({ ...p, email: '' }));
        }}
        placeholder="company@domain.com"
        keyboardType="email-address"
        autoCapitalize="none"
        error={errors.email}
      />
    </View>
  );

  // ────────────────────────────────────────
  // Step 2 — Agencies
  // ────────────────────────────────────────
  const renderStep2 = () => (
    <View style={s.stepBody}>
      {errors.agencies ? (
        <View style={s.errorBanner}>
          <View style={s.errorIconWrap}>
            <Text style={s.errorIconChar}>!</Text>
          </View>
          <Text style={s.errorBannerText}>{errors.agencies}</Text>
        </View>
      ) : null}

      {/* Selection summary */}
      {selectedAgencyIds.length > 0 && (
        <View style={s.selectionSummary}>
          <Ionicons
            name="layers"
            size={16}
            color={DS.green500}
            style={{ marginRight: 8 }}
          />
          <Text style={s.selectionSummaryText}>
            {selectedAgencyIds.length} agenc
            {selectedAgencyIds.length === 1 ? 'y' : 'ies'} selected
          </Text>
        </View>
      )}

      {allAgencies.map(renderAgencyCard)}

      {/* Custom agency */}
      {!showCustomForm ? (
        <TouchableOpacity
          style={s.addCustomButton}
          onPress={() => {
            LayoutAnimation.configureNext(
              LayoutAnimation.Presets.easeInEaseOut,
            );
            setShowCustomForm(true);
          }}
          activeOpacity={0.7}>
          <View style={s.addCustomIconWrap}>
            <Ionicons name="add" size={18} color={DS.blue600} />
          </View>
          <Text style={s.addCustomText}>Add Custom Agency</Text>
        </TouchableOpacity>
      ) : (
        <View style={s.customForm}>
          <View style={s.customFormHeader}>
            <Ionicons
              name="create-outline"
              size={16}
              color={DS.navy800}
              style={{ marginRight: 8 }}
            />
            <Text style={s.customFormTitle}>New Custom Agency</Text>
          </View>
          <AuthField
            label="Agency Name *"
            value={customAgency.name}
            onChangeText={(t: string) => {
              setCustomAgency(p => ({ ...p, name: t }));
              if (errors.customAgencyName) {
                setErrors(prev => {
                  const { customAgencyName: _removed, ...rest } = prev;
                  return rest;
                });
              }
            }}
            placeholder="Agency name"
            error={errors.customAgencyName}
          />
          <AuthSelect
            label="Type"
            options={[
              { label: 'Manufacturing', value: 'Manufacturing' },
              { label: 'Supply', value: 'Supply' },
              { label: 'Distribution', value: 'Distribution' },
            ]}
            value={customAgency.type}
            onChange={(v: string) =>
              setCustomAgency(p => ({ ...p, type: v }))
            }
          />
          <AuthField
            label="Description"
            value={customAgency.description}
            onChangeText={(t: string) =>
              setCustomAgency(p => ({ ...p, description: t }))
            }
            placeholder="Brief description"
          />
          <AuthField
            label="Address"
            value={customAgency.address}
            onChangeText={(t: string) =>
              setCustomAgency(p => ({ ...p, address: t }))
            }
            placeholder="Agency address"
          />
          <AuthField
            label="Contact Phone"
            value={customAgency.contact}
            onChangeText={(t: string) =>
              setCustomAgency(p => ({ ...p, contact: t }))
            }
            placeholder="0312 3456789"
            keyboardType="phone-pad"
          />
          <View style={s.buttonRow}>
            <CustomButton
              title="Cancel"
              onPress={() => setShowCustomForm(false)}
              variant="secondary"
              size="md"
            />
            <View style={s.buttonSpacer} />
            <CustomButton
              title="Add Agency"
              onPress={addCustomAgency}
              variant="primary"
              size="md"
            />
          </View>
        </View>
      )}
    </View>
  );

  // ────────────────────────────────────────
  // Step 3 — Review
  // ────────────────────────────────────────
  const renderStep3 = () => (
    <View style={s.stepBody}>
      {/* Company summary */}
      <View style={s.summaryCard}>
        <View style={s.summaryCardHeader}>
          <Ionicons
            name="business-outline"
            size={16}
            color={DS.navy800}
            style={{ marginRight: 8 }}
          />
          <Text style={s.summaryCardTitle}>Company Details</Text>
        </View>
        <View style={s.summaryDivider} />
        <SummaryRow label="Name" value={companyName} />
        {industry ? (
          <SummaryRow label="Industry" value={industry} />
        ) : null}
        <SummaryRow
          label="Address"
          value={`${street}, ${city}, ${stateProv} ${zipCode}`}
        />
        <SummaryRow label="Phone" value={phone} />
        <SummaryRow label="Email" value={email} />
        {website ? (
          <SummaryRow label="Website" value={website} />
        ) : null}
      </View>

      {/* Agencies summary */}
      <View style={s.summaryCard}>
        <View style={s.summaryCardHeader}>
          <Ionicons
            name="layers-outline"
            size={16}
            color={DS.navy800}
            style={{ marginRight: 8 }}
          />
          <Text style={s.summaryCardTitle}>
            Selected Agencies ({selectedAgencies.length})
          </Text>
        </View>
        <View style={s.summaryDivider} />
        {selectedAgencies.map(a => (
          <View key={a.id} style={s.agencySummaryRow}>
            <View style={s.agencySummaryLeft}>
              <View
                style={[
                  s.agencySummaryDot,
                  { backgroundColor: a.typeBadgeColor },
                ]}
              />
              <Text style={s.agencySummaryName}>{a.name}</Text>
            </View>
            <View style={s.agencySummaryBadge}>
              <Text style={s.agencySummaryItems}>
                {a.inventory.length}
              </Text>
            </View>
          </View>
        ))}
        <View style={s.totalRow}>
          <Text style={s.totalLabel}>Total Inventory Items</Text>
          <Text style={s.totalValue}>{totalItems}</Text>
        </View>
      </View>

      {/* Invite code */}
      <View style={s.inviteCodeCard}>
        <View style={s.inviteIconRow}>
          <View style={s.inviteIconCircle}>
            <Ionicons name="people" size={22} color={DS.navy800} />
          </View>
        </View>
        <Text style={s.inviteCodeLabel}>Company Invite Code</Text>
        <View style={s.codeBoxesRow}>
          {inviteCode.split('').map((char, i) => (
            <View key={i} style={s.codeBox}>
              <Text style={s.codeChar}>{char}</Text>
            </View>
          ))}
        </View>
        <Text style={s.inviteCodeHint}>
          Share this code with your team members to join
        </Text>
      </View>
    </View>
  );

  // ────────────────────────────────────────
  // Main Render
  // ────────────────────────────────────────
  return (
    <AuthLayout
      scrollRef={scrollRef}
      header={
        <AuthHeader
          pill="Company Details"
          title={stepCfg.title}
          subtitle={stepCfg.subtitle}
          onBack={handleBack}
          step={{ current: 2, total: 4 }}
        />
      }
      footer={
        <AuthFooterBar
          primary={{
            label: 'Create Company',
            onPress: handleSubmit,
            loading: isCreating,
            loadingLabel: 'Creating Company',
          }}
          secondary={{ label: 'Cancel', onPress: handleBack }}
          note="Your data is encrypted and secure"
        />
      }>
      {submitError ? (
        <AuthNotice tone="error" message={submitError} />
      ) : null}

      {renderStep1()}
    </AuthLayout>
  );
};

// ═══════════════════════════════════════════════════════
// Summary Row Helper
// ═══════════════════════════════════════════════════════
const SummaryRow: React.FC<{ label: string; value: string }> = ({
  label,
  value
}) => (
  <View style={s.summaryRow}>
    <Text style={s.summaryLabel}>{label}</Text>
    <Text style={s.summaryValue} numberOfLines={2}>
      {value}
    </Text>
  </View>
);

// ═══════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: DS.slate50 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },

  // ── Header (gradient) ──
  header: {
    position: 'relative',
    overflow: 'hidden',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  orbTopRight: { width: 180, height: 180, top: -60, right: -40 },
  orbBottomLeft: { width: 100, height: 100, bottom: -30, left: -20 },
  headerInner: {
    paddingHorizontal: 24,
    paddingBottom: 36,
    paddingTop: 8,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: DS.radius.md,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: { ...THEME.typography.h3, color: DS.white },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: DS.radius.full,
    gap: 6,
  },
  rolePillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: DS.green400,
  },
  rolePillText: {
    ...THEME.typography.overline,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerTitle: {
    ...THEME.typography.h1,
    color: DS.white,
    marginBottom: 6,
    letterSpacing: -0.4,
  },
  headerSub: {
    ...THEME.typography.bodyMd,
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 22,
  },

  // ── Card zone ──
  cardZone: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    marginTop: -1,
  },
  mainCard: {
    backgroundColor: DS.white,
    borderRadius: DS.radius.xl,
    overflow: 'hidden',
    ...DS.shadowLg,
  },

  // ── Step indicator ──
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  stepNode: { alignItems: 'center', gap: 4 },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: DS.slate100,
    borderWidth: 1.5,
    borderColor: DS.slate200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleActive: {
    backgroundColor: DS.navy800,
    borderColor: DS.navy800,
  },
  stepCircleDone: {
    backgroundColor: DS.green500,
    borderColor: DS.green500,
  },
  stepLabel: {
    ...THEME.typography.overline,
    color: DS.slate400,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stepLabelActive: { color: DS.navy800, fontWeight: typography.labelLg.fontWeight },
  stepLabelDone: { color: DS.green500, fontWeight: typography.labelLg.fontWeight },
  stepConnector: {
    flex: 1,
    height: 2,
    backgroundColor: DS.slate200,
    marginHorizontal: 10,
    marginBottom: 18,
    borderRadius: 1,
  },
  stepConnectorDone: { backgroundColor: DS.green500 },

  // ── Progress track ──
  progressTrackWrap: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  progressTrack: {
    height: 4,
    backgroundColor: DS.slate100,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: 4,
    backgroundColor: DS.navy800,
    borderRadius: 2,
  },
  progressLabel: {
    ...THEME.typography.caption,
    color: DS.slate400,
    textAlign: 'right',
  },

  // ── Step body ──
  stepBody: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },

  // ── Section dividers ──
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 12,
  },
  sectionDividerLine: { flex: 1, height: 1, backgroundColor: DS.slate200 },
  sectionDividerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DS.slate50,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: DS.radius.full,
    borderWidth: 1,
    borderColor: DS.slate200,
    gap: 5,
    marginHorizontal: 8,
  },
  sectionDividerText: {
    ...THEME.typography.overline,
    color: DS.slate500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: { flexDirection: 'row', gap: 10 },
  halfInput: { flex: 1 },

  // ── Agency cards ──
  agencyCard: {
    backgroundColor: DS.white,
    borderRadius: DS.radius.lg,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: DS.slate200,
    overflow: 'hidden',
  },
  agencyCardSelected: {
    borderColor: DS.green500,
    backgroundColor: DS.green50 + '40',
  },
  agencyCardHeader: {
    flexDirection: 'row',
    padding: 16,
  },
  agencyCheckbox: { marginRight: 14, marginTop: 2 },
  checkboxUnchecked: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: DS.slate300,
    backgroundColor: DS.white,
  },
  checkboxChecked: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: DS.green500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agencyInfo: { flex: 1 },
  agencyNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  agencyName: {
    ...THEME.typography.labelLg,
    color: DS.navy800,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 5,
  },
  typeBadgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  typeBadgeText: {
    ...THEME.typography.overline,
    
  },
  agencyDesc: {
    ...THEME.typography.bodySm,
    color: DS.slate500,
    marginBottom: 10,
    lineHeight: 18,
  },
  agencyMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  agencyMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  agencyMetaText: {
    ...THEME.typography.caption,
    color: DS.slate500,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: DS.slate100,
    paddingVertical: 10,
  },
  expandText: {
    ...THEME.typography.labelSm,
    color: DS.blue600,
  },
  inventoryPreview: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: DS.slate50,
    borderTopWidth: 1,
    borderTopColor: DS.slate100,
  },
  inventoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: DS.slate200 + '60',
  },
  inventoryDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: DS.slate400,
    marginRight: 10,
  },
  inventoryItemName: {
    ...THEME.typography.bodySm,
    flex: 1,
    color: DS.navy800,
  },
  inventoryItemPrice: {
    ...THEME.typography.labelMd,
    color: DS.green500,
  },

  // ── Selection summary ──
  selectionSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DS.green50,
    borderRadius: DS.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: DS.greenBorder + '60',
  },
  selectionSummaryText: {
    ...THEME.typography.labelMd,
    color: DS.green500,
  },

  // ── Error banner ──
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DS.red50,
    borderRadius: DS.radius.md,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: DS.red100,
    gap: 10,
  },
  errorIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: DS.red500,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorIconChar: { ...THEME.typography.caption, color: DS.white, fontWeight: typography.labelLg.fontWeight },
  errorBannerText: {
    ...THEME.typography.bodySm,
    flex: 1,
    color: DS.red900,
  },

  // ── Add custom ──
  addCustomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: DS.blue100,
    borderStyle: 'dashed',
    borderRadius: DS.radius.lg,
    paddingVertical: 16,
    marginBottom: 12,
    backgroundColor: DS.blue50 + '40',
  },
  addCustomIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: DS.blue50,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  addCustomText: {
    ...THEME.typography.h5,
    color: DS.blue600,
  },
  customForm: {
    backgroundColor: DS.slate50,
    borderRadius: DS.radius.lg,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: DS.slate200,
  },
  customFormHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  customFormTitle: {
    ...THEME.typography.labelLg,
    color: DS.navy800,
  },
  buttonRow: { flexDirection: 'row', marginTop: 12 },
  buttonSpacer: { width: 10 },

  // ── Summary cards ──
  summaryCard: {
    backgroundColor: DS.slate50,
    borderRadius: DS.radius.lg,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: DS.slate100,
  },
  summaryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  summaryCardTitle: {
    ...THEME.typography.h5,
    color: DS.navy800,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: DS.slate200,
    marginBottom: 10,
    marginTop: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: DS.slate200 + '60',
  },
  summaryLabel: {
    ...THEME.typography.bodySm,
    color: DS.slate500,
  },
  summaryValue: {
    ...THEME.typography.bodySm,
    color: DS.navy800,
    flex: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  agencySummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
  },
  agencySummaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  agencySummaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  agencySummaryName: {
    ...THEME.typography.bodySm,
    color: DS.navy800,
  },
  agencySummaryBadge: {
    backgroundColor: DS.slate200,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: DS.radius.full,
  },
  agencySummaryItems: {
    ...THEME.typography.overline,
    color: DS.slate500,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: DS.slate200,
    paddingTop: 12,
    marginTop: 6,
  },
  totalLabel: {
    ...THEME.typography.h5,
    color: DS.navy800,
  },
  totalValue: {
    ...THEME.typography.h5,
    color: DS.green500,
  },

  // ── Invite code ──
  inviteCodeCard: {
    backgroundColor: DS.navy800 + '06',
    borderRadius: DS.radius.lg,
    padding: 22,
    marginBottom: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: DS.navy800 + '12',
  },
  inviteIconRow: { marginBottom: 14 },
  inviteIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: DS.slate100,
    borderWidth: 1,
    borderColor: DS.slate200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inviteCodeLabel: {
    ...THEME.typography.labelSm,
    color: DS.slate500,
    marginBottom: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  codeBoxesRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  codeBox: {
    width: 44,
    height: 52,
    borderRadius: DS.radius.md,
    backgroundColor: DS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: DS.navy800,
    ...DS.shadowSm,
  },
  codeChar: {
    ...THEME.typography.h2,
    color: DS.navy800,
  },
  inviteCodeHint: {
    ...THEME.typography.caption,
    color: DS.slate400,
    textAlign: 'center',
  },

  // ── Action bar ──
  actionBar: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: DS.slate100,
    gap: 10,
  },
  actionSecondary: {
    flex: 1,
    height: 50,
    borderRadius: DS.radius.lg,
    backgroundColor: DS.white,
    borderWidth: 1.5,
    borderColor: DS.slate200,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionSecondaryIcon: {
    ...THEME.typography.bodyLg,
    color: DS.navy800,
    marginRight: 6,
  },
  actionSecondaryLabel: {
    ...THEME.typography.h5,
    color: DS.navy800,
  },
  actionPrimary: {
    flex: 1.4,
    height: 50,
    borderRadius: DS.radius.lg,
    backgroundColor: DS.navy800,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    ...DS.shadowMd,
  },
  actionCreate: {
    backgroundColor: DS.green500,
  },
  actionPrimaryLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPrimaryLabel: {
    ...THEME.typography.h5,
    color: DS.white,
    letterSpacing: 0.3,
  },

  // ── Security footer ──
  secFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
  },
  secDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: DS.green500,
  },
  secText: {
    ...THEME.typography.caption,
    color: DS.slate400,
  }
});

export default CreateCompanyScreen;