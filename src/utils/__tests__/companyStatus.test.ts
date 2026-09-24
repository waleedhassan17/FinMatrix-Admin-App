import { companyStage, companyStatusLabel, isUnsubmitted } from '../companyStatus';

describe('companyStage', () => {
  it.each([
    ['approved', 'active'],
    ['active', 'active'],
    ['inactive', 'inactive'],
    ['suspended', 'inactive'],
    ['rejected', 'rejected'],
    ['pending_approval', 'pending'],
    ['email_verified', 'pending'],
  ])('%s → %s', (status, stage) => {
    expect(companyStage(status)).toBe(stage);
  });
});

describe('companyStatusLabel', () => {
  it('names a never-submitted company for what it is', () => {
    expect(isUnsubmitted('email_verified')).toBe(true);
    expect(companyStatusLabel('email_verified')).toBe('Not submitted');
  });

  it('says what an administrator did, not the database word', () => {
    expect(companyStatusLabel('suspended')).toBe('Deactivated');
    expect(companyStatusLabel('pending_approval')).toBe('Awaiting approval');
    expect(companyStatusLabel('approved')).toBe('Active');
  });
});
