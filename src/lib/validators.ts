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

/** Count special characters in a password */
export function countSpecialChars(password: string): number {
  const matches = password.match(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g);
  return matches ? matches.length : 0;
}

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

  const specialCount = countSpecialChars(password);
  if (specialCount < 1) {
    errors.push('Password harus mengandung minimal 1 karakter spesial (!@#$%^&* dll)');
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
  position: string,
  age: string,
  locationId: string,
  email: string,
  password: string
): ValidationResult => {
  const errors: string[] = [];

  if (!name || name.trim() === '') {
    errors.push('Nama lengkap tidak boleh kosong');
  }

  if (!division || division.trim() === '') {
    errors.push('Divisi tidak boleh kosong');
  }

  if (!position || position.trim() === '') {
    errors.push('Posisi / jabatan tidak boleh kosong');
  }

  if (!age || age.trim() === '') {
    errors.push('Usia tidak boleh kosong');
  } else if (isNaN(Number(age)) || Number(age) < 17 || Number(age) > 70) {
    errors.push('Usia harus angka antara 17-70');
  }

  if (!locationId) {
    errors.push('Cabang harus dipilih');
  }

  // Email validation — ketat
  const emailTrimmed = email?.trim() || '';
  if (!emailTrimmed) {
    errors.push('Email tidak boleh kosong');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
    errors.push('Format email tidak valid (contoh: nama@domain.com)');
  } else if (emailTrimmed.length > 254) {
    errors.push('Email terlalu panjang (maks 254 karakter)');
  } else {
    // Cek common typo domain
    const domain = emailTrimmed.split('@')[1]?.toLowerCase() || '';
    const commonTypos: Record<string, string> = {
      'gmail.co': 'gmail.com',
      'gmial.com': 'gmail.com',
      'gmil.com': 'gmail.com',
      'gmail.cmo': 'gmail.com',
      'gmail.con': 'gmail.com',
      'yahoo.co': 'yahoo.com',
      'yaho.com': 'yahoo.com',
      'yahooo.com': 'yahoo.com',
      'hotmial.com': 'hotmail.com',
      'hotmal.com': 'hotmail.com',
      'outlok.com': 'outlook.com',
      'outloo.com': 'outlook.com',
      'proton.me': 'proton.me',  // valid, no correction
    };
    if (commonTypos[domain]) {
      errors.push(`Mungkin maksud Anda: ${emailTrimmed.split('@')[0]}@${commonTypos[domain]}`);
    }

    // Cek disposable email domains
    const disposableDomains = [
      'mailinator.com', 'guerrillamail.com', '10minutemail.com',
      'tempmail.com', 'throwaway.email', 'yopmail.com',
      'sharklasers.com', 'dropmail.me', 'spam4.me',
      'trashmail.com', 'dispostable.com', 'mailnator.com',
    ];
    if (disposableDomains.includes(domain)) {
      errors.push('Email dari domain sekali pakai tidak diizinkan');
    }
  }

  const passwordValidation = validatePassword(password);

  errors.push(...passwordValidation.errors);

  return {
    isValid: errors.length === 0,
    errors,
  };
};
