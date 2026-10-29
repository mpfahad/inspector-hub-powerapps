/**
 * Field inspector roster — source of truth from Applus qualification matrix (2026-09).
 * Cert issued/expiry dates are placeholders until HR supplies real dates.
 * Daily rates are provisional QAR figures for UAT — Admin edits real values in-app (CM-013).
 */

export type RosterInspector = {
  name: string;
  /** Prior roster name(s) used to match existing DB rows during upsert. */
  aliases?: string[];
  employeeNo: string;
  email: string;
  /** QP Approved Inspector ✓ → Inspector.qeApproved */
  qeApproved: boolean;
  highestQualification?: 'Diploma' | 'Graduate';
  /** Certification codes held (see CERTIFICATION_CATALOG). QP-INSP is via qeApproved only. */
  certCodes: string[];
  dailyCostUsd: number;
  dailyBillableUsd: number;
};

export type RosterClient = {
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  industry?: string;
};

/** Catalog codes seeded into Certification (+ assigned via InspectorCert). */
export const CERTIFICATION_CATALOG: { code: string; name: string; issuer?: string; validityMonths?: number }[] = [
  { code: 'ISO17020-S1', name: 'ISO 17020 Scope 1 — Lifting Equipment General', issuer: 'ISO 17020', validityMonths: 60 },
  { code: 'ISO17020-S2', name: 'ISO 17020 Scope 2 — Lifting Machines Manual', issuer: 'ISO 17020', validityMonths: 60 },
  { code: 'ISO17020-S3', name: 'ISO 17020 Scope 3 — Lifting Machines Power', issuer: 'ISO 17020', validityMonths: 60 },
  { code: 'ISO17020-S4', name: 'ISO 17020 Scope 4 — Fixed Lifting Equipment', issuer: 'ISO 17020', validityMonths: 60 },
  { code: 'ISO17020-S5', name: 'ISO 17020 Scope 5 — Offshore Containers', issuer: 'ISO 17020', validityMonths: 60 },
  { code: 'ISO17020-S6', name: 'ISO 17020 Scope 6 — Cranes', issuer: 'ISO 17020', validityMonths: 60 },
  { code: 'ISO17020-S7', name: 'ISO 17020 Scope 7 — Forklifts', issuer: 'ISO 17020', validityMonths: 60 },
  { code: 'ISO17020-S8', name: 'ISO 17020 Scope 8 — MEWP', issuer: 'ISO 17020', validityMonths: 60 },
  { code: 'ISO17020-S9', name: 'ISO 17020 Scope 9 — Elevators / Excavators', issuer: 'ISO 17020', validityMonths: 60 },
  { code: 'QP-TRAINER', name: 'QP Approved Trainer', issuer: 'QP', validityMonths: 36 },
  { code: 'CIA', name: 'CIA Trained', issuer: 'CIA', validityMonths: 36 },
  { code: 'LEEA-FOUNDATION', name: 'LEEA Foundation Course', issuer: 'LEEA', validityMonths: 60 },
  { code: 'LEG', name: 'LEG — Lifting Equipment General', issuer: 'LEEA', validityMonths: 60 },
  { code: 'LMM', name: 'LMM — Lifting Machines Manual', issuer: 'LEEA', validityMonths: 60 },
  { code: 'LMP', name: 'LMP — Lifting Machines Power', issuer: 'LEEA', validityMonths: 60 },
  { code: 'RCS', name: 'RCS — Runways & Crane Structures', issuer: 'LEEA', validityMonths: 60 },
  { code: 'OTC', name: 'OTC — Overhead Travelling Crane', issuer: 'LEEA', validityMonths: 60 },
  { code: 'OCE', name: 'OCE — Offshore Container / Crane Examination', issuer: 'LEEA', validityMonths: 60 },
  { code: 'MCE', name: 'MCE — Mobile Crane Examination', issuer: 'LEEA', validityMonths: 60 },
  { code: 'NDT', name: 'NDT Qualified Inspector', issuer: 'ASNT/PCN', validityMonths: 60 },
  { code: 'OFFSHORE', name: 'Offshore Certified', issuer: 'Op. cert', validityMonths: 48 },
  { code: 'ROPE-ACCESS', name: 'Rope Access Certified', issuer: 'IRATA/SPRAT', validityMonths: 36 },
  { code: 'AP-LS', name: 'AP or Lifting Supervisor', issuer: 'Op. cert', validityMonths: 36 },
];

/** Placeholder cert window until HR provides real issued/expiry dates. */
export const PLACEHOLDER_CERT_ISSUED = '2024-01-01';
export const PLACEHOLDER_CERT_EXPIRES = '2029-01-01';

const ISO_ALL = [
  'ISO17020-S1', 'ISO17020-S2', 'ISO17020-S3', 'ISO17020-S4', 'ISO17020-S5',
  'ISO17020-S6', 'ISO17020-S7', 'ISO17020-S8', 'ISO17020-S9',
] as const;

const LEEA_CORE = ['LEEA-FOUNDATION', 'LEG', 'LMM', 'LMP', 'RCS', 'OTC', 'OCE', 'MCE'] as const;

/** Broad checkmark pattern from matrix (most scopes/courses held). */
const FULL_MATRIX = [...ISO_ALL, ...LEEA_CORE, 'CIA', 'NDT', 'OFFSHORE'] as string[];

export const FIELD_INSPECTOR_ROSTER: RosterInspector[] = [
  {
    name: 'Abhilash B. Raman',
    aliases: ['Afilash Balan Raman', 'Afilash B. Raman'],
    employeeNo: 'VEQE1264',
    email: 'abhilash.balan@applus.com',
    qeApproved: true,
    highestQualification: 'Diploma',
    dailyCostUsd: 200,
    dailyBillableUsd: 275,
    // Matrix: ISO S1–S8 (not S9), CIA + full LEEA, OTC/OCE/MCE/NDT/Offshore; no trainer/rope/AP
    certCodes: [
      'ISO17020-S1', 'ISO17020-S2', 'ISO17020-S3', 'ISO17020-S4', 'ISO17020-S5',
      'ISO17020-S6', 'ISO17020-S7', 'ISO17020-S8',
      'CIA', 'LEEA-FOUNDATION', 'LEG', 'LMM', 'LMP', 'RCS', 'OTC', 'OCE', 'MCE', 'NDT', 'OFFSHORE',
    ],
  },
  {
    name: 'Afsal Vazhayil',
    employeeNo: 'VEQE3733',
    email: 'afsal.vazhayil@applus.com',
    qeApproved: false,
    highestQualification: 'Diploma',
    dailyCostUsd: 150,
    dailyBillableUsd: 205,
    certCodes: [
      'ISO17020-S1', 'ISO17020-S2', 'ISO17020-S5', 'ISO17020-S7', 'ISO17020-S8',
      'LEEA-FOUNDATION', 'LEG', 'OCE', 'NDT', 'ROPE-ACCESS',
    ],
  },
  {
    name: 'Aju Joseph',
    employeeNo: 'VEQE4219',
    email: 'aju.joseph@applus.com',
    qeApproved: true,
    highestQualification: 'Graduate',
    dailyCostUsd: 200,
    dailyBillableUsd: 275,
    certCodes: [
      ...ISO_ALL,
      'LEEA-FOUNDATION', 'LEG', 'LMM', 'OTC', 'OCE', 'MCE', 'NDT', 'OFFSHORE', 'ROPE-ACCESS',
    ],
  },
  {
    name: 'Arunaravind Kakadath',
    aliases: ['Arunaravind kakadath'],
    employeeNo: 'VEQE0552',
    email: 'arun.kakadath@applus.com',
    qeApproved: true,
    highestQualification: 'Graduate',
    dailyCostUsd: 200,
    dailyBillableUsd: 275,
    certCodes: [
      ...ISO_ALL,
      'CIA', 'LEEA-FOUNDATION', 'LEG', 'LMM', 'RCS', 'OCE', 'MCE', 'NDT', 'OFFSHORE', 'AP-LS',
    ],
  },
  {
    name: 'Binu Antony',
    employeeNo: 'VEQE2824',
    email: 'binu.antony@applus.com',
    qeApproved: false,
    highestQualification: 'Graduate',
    dailyCostUsd: 200,
    dailyBillableUsd: 275,
    certCodes: [...FULL_MATRIX, 'ROPE-ACCESS'],
  },
  {
    name: 'Jinu Varghese',
    employeeNo: 'VEQE4331',
    email: 'jinu.varghese@applus.com',
    qeApproved: false,
    highestQualification: 'Graduate',
    dailyCostUsd: 150,
    dailyBillableUsd: 205,
    certCodes: [...FULL_MATRIX],
  },
  {
    name: 'Julius Pudd Sevilla',
    aliases: ['Julius Puod Sevilla', 'Julius Puod'],
    employeeNo: 'VEQE1233',
    email: 'julius.sevilla@applus.com',
    qeApproved: true,
    highestQualification: 'Graduate',
    dailyCostUsd: 150,
    dailyBillableUsd: 205,
    certCodes: [...FULL_MATRIX, 'AP-LS'],
  },
  {
    name: 'Mayil Raja Tharma Raj',
    employeeNo: 'VEQE2122',
    email: 'mayil.tharmaraj@applus.com',
    qeApproved: false,
    highestQualification: 'Graduate',
    dailyCostUsd: 150,
    dailyBillableUsd: 205,
    certCodes: [...FULL_MATRIX],
  },
  {
    name: 'Muhammed Ayaz',
    aliases: ['Muhammad Ayaz'],
    employeeNo: 'VEQE4957',
    email: 'muhammad.ayaz@applus.com',
    qeApproved: false,
    highestQualification: 'Graduate',
    dailyCostUsd: 150,
    dailyBillableUsd: 205,
    certCodes: [...FULL_MATRIX],
  },
  {
    name: 'Muniasamy Subburam',
    employeeNo: 'VEQE4812',
    email: 'muniasamy.subburam@applus.com',
    qeApproved: false,
    highestQualification: 'Graduate',
    dailyCostUsd: 200,
    dailyBillableUsd: 275,
    certCodes: [...FULL_MATRIX],
  },
  {
    name: 'Muthu Sankar M.',
    aliases: ['Muthusankar Mathusoothanan', 'Muthusankar Mathusoothanam'],
    employeeNo: 'VEQE0954',
    email: 'muthusankar.mathusoothanam@applus.com',
    qeApproved: false,
    highestQualification: 'Diploma',
    dailyCostUsd: 200,
    dailyBillableUsd: 275,
    certCodes: [...FULL_MATRIX],
  },
  {
    name: 'Ram Narayan',
    employeeNo: 'VEQE2125',
    email: 'ram.narayan@applus.com',
    qeApproved: false,
    highestQualification: 'Diploma',
    dailyCostUsd: 150,
    dailyBillableUsd: 205,
    certCodes: [...FULL_MATRIX],
  },
  {
    name: 'Sivakumar Adoni',
    employeeNo: 'VEQE0949',
    email: 'siva.kumar@applus.com',
    qeApproved: false,
    highestQualification: 'Graduate',
    dailyCostUsd: 200,
    dailyBillableUsd: 275,
    certCodes: [...FULL_MATRIX],
  },
  {
    name: 'Sooraj K.V',
    aliases: ['Sooraj Kolel Veedu'],
    employeeNo: 'VEQE4384',
    email: 'sooraj.veedu@applus.com',
    qeApproved: false, // QP Trainer only — not QP Approved Inspector
    highestQualification: 'Graduate',
    dailyCostUsd: 200,
    dailyBillableUsd: 275,
    certCodes: [
      ...ISO_ALL,
      'QP-TRAINER',
      'CIA',
      'LEEA-FOUNDATION',
      'LEG',
      'LMM',
      'LMP',
      'RCS',
      'OTC',
      'OCE',
      'MCE',
      'NDT',
      'OFFSHORE',
    ],
  },
  {
    name: 'Sreejith K. S.',
    aliases: ['Sreejith Kavupra Sankarankutty', 'Sreejith K.S.'],
    employeeNo: 'VEQE1395',
    email: 'sreejith.sankarankutty@applus.com',
    qeApproved: false,
    highestQualification: 'Graduate',
    dailyCostUsd: 150,
    dailyBillableUsd: 205,
    certCodes: [...FULL_MATRIX],
  },
  {
    name: 'Srinivasan Ethirajan',
    employeeNo: 'VEQE0481',
    email: 'srinivasan.ethiran@applus.com',
    qeApproved: false,
    highestQualification: 'Graduate',
    dailyCostUsd: 150,
    dailyBillableUsd: 205,
    certCodes: [...FULL_MATRIX],
  },
  {
    name: 'Venkatasan Karuppiah',
    aliases: ['Venkatesan Karuppiya', 'Venkatesan Karuppiah'],
    employeeNo: 'VEQE2119',
    email: 'venkatasan.karuppiya@applus.com',
    qeApproved: false,
    highestQualification: 'Graduate',
    dailyCostUsd: 150,
    dailyBillableUsd: 205,
    certCodes: [...FULL_MATRIX],
  },
];

/** Qatar operating clients — primary site used for map lat/lng. */
export const QATAR_CLIENTS: RosterClient[] = [
  {
    name: 'A. A. ENGINEERING SERVICES',
    location: 'Doha Industrial Area',
    latitude: 25.1745,
    longitude: 51.4392,
    industry: 'Industrial services',
  },
  {
    name: 'VENTUREGULF',
    location: 'Doha Industrial Area',
    latitude: 25.178,
    longitude: 51.442,
    industry: 'Oil & Gas services',
  },
  {
    name: 'PETROLEUM TECHNOLOGY',
    location: 'Ras Laffan, Birkat',
    latitude: 25.9128,
    longitude: 51.5431,
    industry: 'Oil & Gas',
  },
  {
    name: 'QATAR WELDING & FABRICATION SUPPLIES (QFAB)',
    location: 'Birkat',
    latitude: 25.85,
    longitude: 51.52,
    industry: 'Fabrication',
  },
  {
    name: 'MANLIFT QATAR',
    location: 'Birkat, Ras Laffan',
    latitude: 25.88,
    longitude: 51.53,
    industry: 'Lifting / MEWP',
  },
  {
    name: 'CONSOLIDATED CONTRACTORS GROUP (CCC)',
    location: 'Ras Laffan',
    latitude: 25.92,
    longitude: 51.55,
    industry: 'Construction',
  },
  {
    name: 'WEATHERFORD WELL SERVICES',
    location: 'Jerry Al Samour, Industrial Area',
    latitude: 25.2,
    longitude: 51.45,
    industry: 'Oilfield services',
  },
  {
    name: 'HALLIBURTON WORLDWIDE',
    location: 'Ras Laffan, Dukhan',
    latitude: 25.4244,
    longitude: 50.7822,
    industry: 'Oilfield services',
  },
  {
    name: 'GULF AGENCY CO.',
    location: 'Al Khor, Industrial Area',
    latitude: 25.6804,
    longitude: 51.4969,
    industry: 'Marine / agency',
  },
  {
    name: 'SEASHORE ENGINEERING',
    location: 'Al Khor, Ras Laffan',
    latitude: 25.7,
    longitude: 51.51,
    industry: 'Engineering',
  },
];

export function pendingEmployeeNo(index: number) {
  return `TBD-${String(index + 1).padStart(2, '0')}`;
}

export function rosterMatchNames(row: RosterInspector): string[] {
  return [row.name, ...(row.aliases ?? [])];
}
