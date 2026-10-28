export type Sensitivity = "low" | "medium" | "high";

export type Settings = {
  emergencyNumber: string;
  pin: string; // empty = no PIN
  shakeEnabled: boolean;
  shakeSensitivity: Sensitivity;
  testMode: boolean;
  displayName: string;
  fakeCaller: { name: string; number: string; photo: string }; // photo = data URL
  ringVolume: number; // 0..1
  ringTones: 2 | 3;
  onboarded: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  emergencyNumber: "112",
  pin: "",
  shakeEnabled: false,
  shakeSensitivity: "medium",
  testMode: false,
  displayName: "",
  fakeCaller: { name: "Mom", number: "+91 98765 43210", photo: "" },
  ringVolume: 0.7,
  ringTones: 2,
  onboarded: false,
};

export const COUNTRY_NUMBERS: { label: string; number: string }[] = [
  { label: "India / EU (112)", number: "112" },
  { label: "USA / Canada (911)", number: "911" },
  { label: "UK (999)", number: "999" },
  { label: "Australia (000)", number: "000" },
  { label: "New Zealand (111)", number: "111" },
  { label: "Japan (110)", number: "110" },
];

export type Contact = {
  id: string;
  name: string;
  phone: string;
  relation: string | null;
  priority: number;
};

export const MAX_CONTACTS = 5;
