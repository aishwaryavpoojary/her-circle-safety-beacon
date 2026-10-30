export type Sensitivity = "low" | "medium" | "high";
export type EmergencyNumber = { label: string; number: string };
export const DEFAULT_EMERGENCY_NUMBERS: EmergencyNumber[] = [
  { number: "112", label: "National Emergency" },
  { number: "1091", label: "Women Helpline" },
  { number: "100", label: "Police" },
  { number: "108", label: "Ambulance" },
];

export type Settings = {
  emergencyNumber: string;
  emergencyRegion: string;
  emergencyNumbers: EmergencyNumber[];
  autoSos: boolean;
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
  emergencyRegion: "India",
  emergencyNumbers: DEFAULT_EMERGENCY_NUMBERS,
  autoSos: true,
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
