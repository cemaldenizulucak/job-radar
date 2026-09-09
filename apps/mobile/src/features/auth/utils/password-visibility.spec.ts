import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { authCopy } from '../copy';
import {
  isPasswordMasked,
  passwordVisibilityLabel,
} from './password-visibility';

const fieldSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../components/auth-text-field.tsx'),
  'utf8',
);

describe('password visibility', () => {
  it('labels the toggle from the current visibility state', () => {
    expect(passwordVisibilityLabel(false)).toBe(authCopy.showPassword);
    expect(passwordVisibilityLabel(true)).toBe(authCopy.hidePassword);
    expect(isPasswordMasked(true, false)).toBe(true);
    expect(isPasswordMasked(true, true)).toBe(false);
    expect(isPasswordMasked(false, true)).toBe(false);
  });

  it('keeps visibility local to the password field and does not submit the form', () => {
    expect(fieldSource).toContain('const [passwordVisible, setPasswordVisible] = useState(false)');
    expect(fieldSource).toContain("accessibilityRole=\"button\"");
    expect(fieldSource).toContain('passwordVisibilityLabel(passwordVisible)');
    expect(fieldSource).toContain('event.preventDefault()');
    expect(fieldSource).toContain('onPressIn');
    expect(fieldSource).toContain('event.stopPropagation()');
    expect(fieldSource).toContain('width: 44');
    expect(fieldSource).toContain('height: 44');
    expect(fieldSource).not.toContain('Keyboard.dismiss');
    expect(fieldSource).not.toContain('console.log');
    expect(fieldSource).not.toContain('handleSubmit');
  });

  it('uses the shared field on login and register instead of copying toggle code', () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const login = readFileSync(join(dir, '../screens/login-screen.tsx'), 'utf8');
    const register = readFileSync(join(dir, '../screens/register-screen.tsx'), 'utf8');
    expect(login).toContain('AuthTextField');
    expect(login).toContain('secureTextEntry');
    expect(register).toContain('AuthTextField');
    expect(register).toContain('secureTextEntry');
    expect(login).not.toContain('passwordVisible');
    expect(register).not.toContain('passwordVisible');
  });
});
