import {
  classifyJobRoleFamily,
  classifySearch,
  classifySearchTerm,
  hasCompetingTechnology,
  isDirectFrontendUiRole,
  isRoleCompatibleWithTechnologies,
  technologyNeedles,
} from './search-terms.js';

describe('classifySearchTerm', () => {
  it('classifies known skills as technology', () => {
    expect(classifySearchTerm('angular').kind).toBe('technology');
    expect(classifySearchTerm('React').kind).toBe('technology');
    expect(classifySearchTerm('TypeScript').kind).toBe('technology');
    expect(classifySearchTerm('node.js').kind).toBe('technology');
    expect(classifySearchTerm('.NET').kind).toBe('technology');
  });

  it('classifies job titles as role terms', () => {
    expect(classifySearchTerm('frontend developer').kind).toBe('role');
    expect(classifySearchTerm('frontend engineer').kind).toBe('role');
    expect(classifySearchTerm('software engineer').kind).toBe('role');
  });
});

describe('classifySearch', () => {
  it('moves angular from keywords into technology terms', () => {
    const classified = classifySearch({
      keywords: ['angular'],
      technologies: [],
    });

    expect(classified.roleKeywords).toEqual([]);
    expect(classified.technologyTerms).toEqual(['angular']);
    expect(classified.technologyFamilies).toEqual(['frontend']);
  });

  it('keeps frontend developer as a role and angular as a technology', () => {
    const classified = classifySearch({
      keywords: ['frontend developer'],
      technologies: ['angular'],
    });

    expect(classified.roleKeywords).toEqual(['frontend developer']);
    expect(classified.technologyTerms).toEqual(['angular']);
  });
});

describe('technologyNeedles', () => {
  it('expands node.js aliases after normalization', () => {
    expect(technologyNeedles('node.js')).toEqual(
      expect.arrayContaining(['node js', 'nodejs', 'node']),
    );
  });
});

describe('job role compatibility', () => {
  it('treats frontend titles as compatible with Angular', () => {
    expect(classifyJobRoleFamily('Senior Frontend Developer')).toBe('frontend');
    expect(
      isRoleCompatibleWithTechnologies('frontend', ['frontend']),
    ).toBe('compatible');
  });

  it('treats Java Developer as incompatible with Angular', () => {
    expect(classifyJobRoleFamily('Java Developer')).toBe('backend');
    expect(
      isRoleCompatibleWithTechnologies('backend', ['frontend']),
    ).toBe('incompatible');
  });

  it('treats Software Developer as a generic software role', () => {
    expect(classifyJobRoleFamily('Software Developer')).toBe('software');
    expect(
      isRoleCompatibleWithTechnologies('software', ['frontend']),
    ).toBe('generic');
  });

  it('treats web developer titles as generic software, not frontend UI', () => {
    expect(classifyJobRoleFamily('Senior Web Application Developer')).toBe(
      'software',
    );
    expect(classifyJobRoleFamily('WEB YAZILIM UZMANI')).toBe('software');
    expect(isDirectFrontendUiRole('Senior Web Application Developer')).toBe(false);
    expect(isDirectFrontendUiRole('WEB YAZILIM UZMANI')).toBe(false);
    expect(isDirectFrontendUiRole('Frontend Developer')).toBe(true);
    expect(isDirectFrontendUiRole('Arayüz Yazılım Uzmanı')).toBe(true);
    expect(isDirectFrontendUiRole('UI Developer')).toBe(true);
  });

  it('does not treat medical specialist titles as software roles', () => {
    expect(classifyJobRoleFamily('Aile Hekimliği Uzmanı Kat Hekimi')).toBe(
      'none',
    );
  });

  it('classifies React Native Developer as mobile', () => {
    expect(classifyJobRoleFamily('React Native Developer')).toBe('mobile');
  });

  it('classifies Yazılım Mühendisi as a software role', () => {
    expect(classifyJobRoleFamily('Yazılım Mühendisi')).toBe('software');
  });
});

describe('hasCompetingTechnology', () => {
  it('treats React in the title as competing with Angular', () => {
    expect(
      hasCompetingTechnology('Senior Frontend Engineer (React)', ['angular']),
    ).toBe(true);
  });

  it('does not treat Next.js as competing with React', () => {
    expect(hasCompetingTechnology('Frontend Developer - Next', ['react'])).toBe(
      false,
    );
  });

  it('treats Next.js as competing with Angular', () => {
    expect(hasCompetingTechnology('Frontend Developer - Next', ['angular'])).toBe(
      true,
    );
  });

  it('does not treat TypeScript as competing with Angular', () => {
    expect(
      hasCompetingTechnology('Senior Frontend Developer TypeScript', ['angular']),
    ).toBe(false);
  });
});
