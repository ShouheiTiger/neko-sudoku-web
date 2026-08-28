// §33 Minimal release metadata. NOT a version system — two constants surfaced in the Help
// footer. appVersion mirrors package.json; puzzleBankVersion mirrors the committed bank.
import { BANK_VERSION } from "../data/bank/format.js";

export const APP_VERSION = "1.0.0";
export const PUZZLE_BANK_VERSION = BANK_VERSION; // "v1"
