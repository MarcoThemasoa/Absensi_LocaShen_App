/**
 * Validasi keamanan untuk login dan registrasi
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export const validateEmployeeId = (id: string): ValidationResult => {
  const errors: string[] = [];

  if (!id || id.trim() === '') {
    errors.push('ID Karyawan tidak boleh kosong');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const validatePassword = (password: string): ValidationResult => {
  const errors: string[] = [];

  if (!password || password.trim() === '') {
    errors.push('Password tidak boleh kosong');
    return { isValid: false, errors };
  }

  if (password.length < 5) {
    errors.push('Password minimal 5 karakter');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password harus mengandung huruf besar (A-Z)');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password harus mengandung huruf kecil (a-z)');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password harus mengandung angka (0-9)');
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password harus mengandung karakter spesial (!@#$%^&* dll)');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const validateLoginForm = (
  id: string,
  password: string
): ValidationResult => {
  const idValidation = validateEmployeeId(id);
  const passwordValidation = validatePassword(password);

  const allErrors = [...idValidation.errors, ...passwordValidation.errors];

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
  };
};

export const validateRegisterForm = (
  name: string,
  division: string,
  age: string,
  locationId: string,
  id: string,
  password: string
): ValidationResult => {
  const errors: string[] = [];

  if (!name || name.trim() === '') {
    errors.push('Nama lengkap tidak boleh kosong');
  }

  if (!division || division.trim() === '') {
    errors.push('Divisi tidak boleh kosong');
  }

  if (!age || age.trim() === '') {
    errors.push('Usia tidak boleh kosong');
  } else if (isNaN(Number(age)) || Number(age) < 17 || Number(age) > 70) {
    errors.push('Usia harus angka antara 17-70');
  }

  if (!locationId) {
    errors.push('Cabang harus dipilih');
  }

  const idValidation = validateEmployeeId(id);
  const passwordValidation = validatePassword(password);

  errors.push(...idValidation.errors, ...passwordValidation.errors);

  return {
    isValid: errors.length === 0,
    errors,
  };
};
