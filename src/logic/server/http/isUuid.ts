const hex = "0123456789abcdefABCDEF";

export function isUuid(value: string): boolean {
  if (value.length !== 36) {
    return false;
  }
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character == null) {
      return false;
    }
    if (index === 8 || index === 13 || index === 18 || index === 23) {
      if (character !== "-") {
        return false;
      }
      continue;
    }
    if (!hex.includes(character)) {
      return false;
    }
  }
  return true;
}
