import { CountryDto } from '../services/api';

export interface PhoneCodeOption {
  countryName: string;
  countryCode?: string;
  dialCode: string;
}

export interface LocalNumberConstraints {
  min: number;
  max: number;
}

export const DEFAULT_PHONE_CODE = '+20';

export const FALLBACK_PHONE_CODES: PhoneCodeOption[] = [
  { countryName: 'Egypt', countryCode: 'EG', dialCode: '+20' },
  { countryName: 'Saudi Arabia', countryCode: 'SA', dialCode: '+966' },
  { countryName: 'United Arab Emirates', countryCode: 'AE', dialCode: '+971' },
  { countryName: 'Qatar', countryCode: 'QA', dialCode: '+974' },
  { countryName: 'Kuwait', countryCode: 'KW', dialCode: '+965' },
  { countryName: 'Algeria', countryCode: 'DZ', dialCode: '+213' },
];

const DEFAULT_LOCAL_CONSTRAINTS: LocalNumberConstraints = { min: 7, max: 12 };

const LOCAL_NUMBER_OVERRIDES: Record<string, LocalNumberConstraints> = {
  '+20': { min: 11, max: 11 },
};

export function normalizeDialCode(code: string): string {
  const trimmed = code.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.startsWith('+') ? trimmed : `+${trimmed}`;
}

export function buildE164Number(dialCode: string, localNumber: string): string {
  const normalizedCode = normalizeDialCode(dialCode);
  let normalizedLocal = localNumber.replace(/\D/g, '');
  
  if (normalizedCode === '+20' && normalizedLocal.startsWith('0')) {
    normalizedLocal = normalizedLocal.substring(1);
  }
  
  return `${normalizedCode}${normalizedLocal}`;
}

export function getLocalNumberConstraints(dialCode: string): LocalNumberConstraints {
  const normalizedCode = normalizeDialCode(dialCode);
  return LOCAL_NUMBER_OVERRIDES[normalizedCode] ?? DEFAULT_LOCAL_CONSTRAINTS;
}

export function getLocalNumberPattern(dialCode: string): string {
  const normalizedCode = normalizeDialCode(dialCode);
  const { min, max } = getLocalNumberConstraints(dialCode);
  
  if (normalizedCode === '+20') {
    return `^01\\d{${min - 2},${max - 2}}$`;
  }
  
  return `^\\d{${min},${max}}$`;
}

export function isLocalNumberValid(dialCode: string, localNumber: string): boolean {
  const normalizedCode = normalizeDialCode(dialCode);
  const digits = localNumber.replace(/\D/g, '');
  const { min, max } = getLocalNumberConstraints(dialCode);
  
  if (normalizedCode === '+20' && !digits.startsWith('01')) {
    return false;
  }
  
  return digits.length >= min && digits.length <= max;
}

export function splitPhoneNumber(
  fullNumber: string,
  options: PhoneCodeOption[],
): { dialCode: string; localNumber: string } {
  const normalized = fullNumber.replace(/[\s()-]/g, '');
  const withPlus = normalized.startsWith('+') ? normalized : `+${normalized}`;

  const sortedCodes = options
    .map((option) => normalizeDialCode(option.dialCode))
    .filter((code) => code.length > 1)
    .sort((a, b) => b.length - a.length);

  const matchedCode = sortedCodes.find((code) => withPlus.startsWith(code));
  if (!matchedCode) {
    return {
      dialCode: DEFAULT_PHONE_CODE,
      localNumber: withPlus.replace(/^\+/, ''),
    };
  }

  let localNumber = withPlus.slice(matchedCode.length);
  
  // Auto-correct Egyptian numbers that start with '1' and are 10 digits long
  if (matchedCode === '+20' && localNumber.startsWith('1') && localNumber.length === 10) {
    localNumber = '0' + localNumber;
  }

  return {
    dialCode: matchedCode,
    localNumber: localNumber,
  };
}

export function mapCountriesToPhoneCodes(countries: CountryDto[]): PhoneCodeOption[] {
  const mapped = countries
    .filter((country) => country.phoneCode)
    .map((country) => ({
      countryName: country.countryName,
      countryCode: country.countryCode,
      dialCode: normalizeDialCode(country.phoneCode),
    }))
    .filter((option) => option.dialCode.length > 1)
    .sort((a, b) => a.countryName.localeCompare(b.countryName));

  return mapped.length ? mapped : FALLBACK_PHONE_CODES;
}
