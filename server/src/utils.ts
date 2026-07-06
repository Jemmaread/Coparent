export function generateInviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

const PARENT_COLORS = ["#4f8cff", "#ef6f6f", "#3fb984", "#f5a623"];

export function pickParentColor(existingColors: string[]): string {
  const unused = PARENT_COLORS.find((c) => !existingColors.includes(c));
  return unused || PARENT_COLORS[existingColors.length % PARENT_COLORS.length];
}
