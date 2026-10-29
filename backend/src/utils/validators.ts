// backend/src/utils/validators.ts
import { HttpError } from './tenant';

export const toInt = (v: any): number | null => {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
};

export const requireInt = (name: string, v: any): number => {
  const n = toInt(v);
  if (n === null) {
    throw new HttpError(400, `Parámetro inválido: ${name} debe ser numérico entero`);
  }
  return n;
};

export const requireNonEmptyString = (name: string, v: any): string => {
  if (typeof v !== 'string' || !v.trim()) {
    throw new HttpError(400, `Campo "${name}" es obligatorio`);
  }
  return v.trim();
};
