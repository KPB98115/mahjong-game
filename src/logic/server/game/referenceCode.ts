export function isFiveDigitCode(value: string): boolean {
  if (value.length !== 5) {
    return false;
  }
  for (const character of value) {
    if (character < "0" || character > "9") {
      return false;
    }
  }
  return true;
}
