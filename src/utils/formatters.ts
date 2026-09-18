import dayjs from 'dayjs';

export const formatCurrency = (amount: number, currency = 'Rs '): string => {
  const sign = amount < 0 ? '-' : '';
  const formatted = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}${currency}${formatted}`;
};

export const formatDate = (date: string | Date): string =>
  dayjs(date).format('MMM D, YYYY');

export const formatDateTime = (date: string | Date): string =>
  dayjs(date).format('MMM D, YYYY h:mm A');

export const formatPhoneNumber = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
};

export const truncateText = (text: string, maxLength: number): string =>
  text.length <= maxLength ? text : text.substring(0, maxLength - 3) + '...';
