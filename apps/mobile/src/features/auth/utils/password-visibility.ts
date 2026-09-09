import { authCopy } from '../copy';

export function passwordVisibilityLabel(visible: boolean): string {
  return visible ? authCopy.hidePassword : authCopy.showPassword;
}

export function isPasswordMasked(isSecureField: boolean, visible: boolean): boolean {
  return isSecureField && !visible;
}
