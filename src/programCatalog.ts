// Program catalog for Smart Client Matching — mock data until a real programs table exists.
// Institution / program names line up with the seeded partners and application offers, so the
// live CSC application records can be folded into each program's historical insights.

export type EnglishTest = 'IELTS' | 'PTE' | 'TOEFL' | 'Duolingo';
export type ProgramLevel = 'Diploma' | 'Bachelor' | 'Master';

export interface Program {
  id: string;
  institution: string;
  program: string;
  field: string;
  level: ProgramLevel;
  country: string;
  city: string;
  /** Annual tuition in USD (approximate), so programs in different countries compare fairly. */
  tuitionUsd: number;
  duration: string;
  /** Intake months, e.g. ['Feb', 'Jul']. */
  intakes: string[];
  /** Minimum completed qualification — one of QUALIFICATION_LEVELS. */
  minQualification: string;
  /** Minimum GPA on a 4.0 scale. */
  minGpa: number;
  /** Minimum overall score per accepted test; a missing test isn't accepted. */
  english: Partial<Record<EnglishTest, number>>;
  admission: string;
  /** Applications close this many weeks before the intake starts. */
  deadlineWeeks: number;
  /** Baseline historical outcomes from past CSC files (mock). Live records are added on top. */
  history: { approved: number; refused: number; enrolled: number };
}

/** Qualification ladder, lowest first — used to check a client meets a program's entry level. */
export const QUALIFICATION_LEVELS = ['SEE', '+2/A Level', 'Diploma', "Bachelor's", "Master's", 'PhD'];

export const ENGLISH_TESTS: EnglishTest[] = ['IELTS', 'PTE', 'TOEFL', 'Duolingo'];

export const BUDGET_RANGES: { key: string; label: string; max: number }[] = [
  { key: 'any', label: 'Any budget', max: Infinity },
  { key: '15', label: 'Up to $15,000 / year', max: 15000 },
  { key: '25', label: 'Up to $25,000 / year', max: 25000 },
  { key: '35', label: 'Up to $35,000 / year', max: 35000 },
  { key: '50', label: 'Up to $50,000 / year', max: 50000 },
];

export const PROGRAMS: Program[] = [
  {
    id: 'pg1', institution: 'University of Sydney', program: 'Bachelor of IT', field: 'Information Technology', level: 'Bachelor',
    country: 'Australia', city: 'Sydney, NSW', tuitionUsd: 34000, duration: '3 years', intakes: ['Feb', 'Jul'],
    minQualification: '+2/A Level', minGpa: 3.0, english: { IELTS: 6.5, PTE: 61, TOEFL: 85 },
    admission: '+2 in Science or Management with Mathematics; minimum GPA 3.0', deadlineWeeks: 10,
    history: { approved: 42, refused: 6, enrolled: 51 },
  },
  {
    id: 'pg2', institution: 'Monash University', program: 'Master of Data Science', field: 'Data Science', level: 'Master',
    country: 'Australia', city: 'Melbourne, VIC', tuitionUsd: 36000, duration: '2 years', intakes: ['Feb', 'Jul'],
    minQualification: "Bachelor's", minGpa: 3.0, english: { IELTS: 6.5, PTE: 58, TOEFL: 79 },
    admission: "Bachelor's in a quantitative field (IT, Engineering, Statistics); GPA 3.0", deadlineWeeks: 12,
    history: { approved: 28, refused: 5, enrolled: 34 },
  },
  {
    id: 'pg3', institution: 'Deakin University', program: 'Bachelor of Nursing', field: 'Nursing & Health', level: 'Bachelor',
    country: 'Australia', city: 'Geelong, VIC', tuitionUsd: 27000, duration: '3 years', intakes: ['Mar', 'Jul', 'Nov'],
    minQualification: '+2/A Level', minGpa: 2.8, english: { IELTS: 7.0, PTE: 65 },
    admission: '+2 in Science with Biology; police check and immunisation record', deadlineWeeks: 8,
    history: { approved: 36, refused: 11, enrolled: 44 },
  },
  {
    id: 'pg4', institution: 'Kaplan Business School', program: 'Diploma of Hospitality', field: 'Hospitality', level: 'Diploma',
    country: 'Australia', city: 'Adelaide, SA', tuitionUsd: 14000, duration: '1.5 years', intakes: ['Jan', 'Apr', 'Jul', 'Oct'],
    minQualification: '+2/A Level', minGpa: 2.2, english: { IELTS: 5.5, PTE: 46, Duolingo: 95 },
    admission: '+2 in any stream', deadlineWeeks: 6,
    history: { approved: 19, refused: 12, enrolled: 27 },
  },
  {
    id: 'pg5', institution: 'University of Toronto', program: 'BSc Computer Science', field: 'Information Technology', level: 'Bachelor',
    country: 'Canada', city: 'Toronto, ON', tuitionUsd: 45000, duration: '4 years', intakes: ['Sep'],
    minQualification: '+2/A Level', minGpa: 3.5, english: { IELTS: 6.5, TOEFL: 100, Duolingo: 120 },
    admission: '+2 Science with Mathematics and Physics; GPA 3.5+', deadlineWeeks: 30,
    history: { approved: 9, refused: 3, enrolled: 11 },
  },
  {
    id: 'pg6', institution: 'Seneca College', program: 'Business Administration Diploma', field: 'Business & Management', level: 'Diploma',
    country: 'Canada', city: 'Toronto, ON', tuitionUsd: 15500, duration: '2 years', intakes: ['Jan', 'May', 'Sep'],
    minQualification: '+2/A Level', minGpa: 2.5, english: { IELTS: 6.0, PTE: 53, TOEFL: 80, Duolingo: 105 },
    admission: '+2 in any stream with English', deadlineWeeks: 16,
    history: { approved: 31, refused: 14, enrolled: 40 },
  },
  {
    id: 'pg7', institution: 'Humber College', program: 'Practical Nursing', field: 'Nursing & Health', level: 'Diploma',
    country: 'Canada', city: 'Toronto, ON', tuitionUsd: 17000, duration: '2 years', intakes: ['Jan', 'Sep'],
    minQualification: '+2/A Level', minGpa: 2.8, english: { IELTS: 6.5, PTE: 58, TOEFL: 88 },
    admission: '+2 Science with Biology and Chemistry', deadlineWeeks: 20,
    history: { approved: 22, refused: 9, enrolled: 27 },
  },
  {
    id: 'pg8', institution: 'University of Manchester', program: 'MSc Engineering Management', field: 'Engineering', level: 'Master',
    country: 'United Kingdom', city: 'Manchester', tuitionUsd: 33000, duration: '1 year', intakes: ['Sep'],
    minQualification: "Bachelor's", minGpa: 3.0, english: { IELTS: 6.5, PTE: 64, TOEFL: 90 },
    admission: "Bachelor's in Engineering; 1 year work experience preferred", deadlineWeeks: 14,
    history: { approved: 17, refused: 2, enrolled: 19 },
  },
  {
    id: 'pg9', institution: 'Coventry University', program: 'BA Business Management', field: 'Business & Management', level: 'Bachelor',
    country: 'United Kingdom', city: 'Coventry', tuitionUsd: 21000, duration: '3 years', intakes: ['Jan', 'May', 'Sep'],
    minQualification: '+2/A Level', minGpa: 2.6, english: { IELTS: 6.0, PTE: 59, Duolingo: 105 },
    admission: '+2 in any stream; GPA 2.6+', deadlineWeeks: 8,
    history: { approved: 38, refused: 7, enrolled: 46 },
  },
  {
    id: 'pg10', institution: 'Arizona State University', program: 'MS Data Analytics', field: 'Data Science', level: 'Master',
    country: 'USA', city: 'Tempe, AZ', tuitionUsd: 32000, duration: '1.5 years', intakes: ['Jan', 'Aug'],
    minQualification: "Bachelor's", minGpa: 3.0, english: { IELTS: 6.5, TOEFL: 80, Duolingo: 115 },
    admission: "Bachelor's with statistics or programming coursework", deadlineWeeks: 16,
    history: { approved: 14, refused: 8, enrolled: 18 },
  },
  {
    id: 'pg11', institution: 'University of Auckland', program: 'Master of Public Health', field: 'Public Health', level: 'Master',
    country: 'New Zealand', city: 'Auckland', tuitionUsd: 30000, duration: '1.5 years', intakes: ['Mar', 'Jul'],
    minQualification: "Bachelor's", minGpa: 3.0, english: { IELTS: 6.5, PTE: 58, TOEFL: 90 },
    admission: "Bachelor's in Health Sciences, Nursing or related field", deadlineWeeks: 12,
    history: { approved: 12, refused: 1, enrolled: 13 },
  },
  {
    id: 'pg12', institution: 'Lincoln University', program: 'Bachelor of Agriculture', field: 'Agriculture', level: 'Bachelor',
    country: 'New Zealand', city: 'Lincoln, Canterbury', tuitionUsd: 23000, duration: '3 years', intakes: ['Feb', 'Jul'],
    minQualification: '+2/A Level', minGpa: 2.5, english: { IELTS: 6.0, PTE: 50, TOEFL: 80 },
    admission: '+2 in Science; interest in agribusiness or farm management', deadlineWeeks: 10,
    history: { approved: 10, refused: 2, enrolled: 12 },
  },
];

export const PROGRAM_FIELDS = Array.from(new Set(PROGRAMS.map((p) => p.field))).sort();
