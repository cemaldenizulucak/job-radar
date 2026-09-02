import {
  decideListingWrite,
  sourceListingIdentity,
} from './job-identity.js';

describe('source listing identity', () => {
  it('treats the same source and source_job_id as one listing', () => {
    expect(sourceListingIdentity('linkedin', 'li-abc-frontend')).toBe(
      'linkedin:li-abc-frontend',
    );
    expect(decideListingWrite('existing-id')).toBe('update');
    expect(decideListingWrite(null)).toBe('insert');
  });

  it('keeps the same role on two sources as two identities', () => {
    const linkedIn = sourceListingIdentity('linkedin', 'abc-frontend');
    const kariyer = sourceListingIdentity('kariyer_net', 'abc-frontend');

    expect(linkedIn).not.toBe(kariyer);
  });
});
