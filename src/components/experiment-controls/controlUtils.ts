export const RANGE_THUMB_WIDTH_PX = 8;

export function formatControlValue(value: number, digits = 1) {
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}

export function clampControlValue(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getStepPrecision(step: number) {
  const raw = String(step);
  if (!raw.includes(".")) {
    return 0;
  }

  return raw.length - raw.indexOf(".") - 1;
}

export function snapControlValue(value: number, min: number, step: number) {
  const precision = getStepPrecision(step);
  const snapped = Math.round((value - min) / step) * step + min;
  return Number(snapped.toFixed(precision));
}

export function toControlId(label: string) {
  return label.toLowerCase().replace(/\s+/g, "-");
}

export function getControlInputWidth(min: number, max: number, step: number) {
  const integerDigits = Math.max(
    String(Math.trunc(Math.abs(min))).length,
    String(Math.trunc(Math.abs(max))).length,
    1,
  );
  const signChars = min < 0 || max < 0 ? 1 : 0;
  const decimalChars = getStepPrecision(step);
  const totalChars =
    integerDigits + signChars + (decimalChars > 0 ? decimalChars + 1 : 0);

  return `calc(${Math.max(totalChars + 1, 4)}ch + 0.75rem)`;
}
