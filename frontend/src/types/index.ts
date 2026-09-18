export type UserRole = "ROOT" | "INVIGILATOR" | "STUDENT";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  metadata?: {
    rollNumber?: string;
    department?: string;
    employeeId?: string;
    designation?: string;
  };
}

export interface Department {
  id: string;
  code: "CSE" | "ECE" | "EEE" | "MECH" | "CIVIL";
  name: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export interface Student {
  id: string;
  rollNumber: string;
  name: string;
  email: string;
  departmentCode: "CSE" | "ECE" | "EEE" | "MECH" | "CIVIL";
  semester: number;
  batchYear: string;
  status: "ACTIVE" | "DETAINED" | "EXEMPTED";
}

export interface Invigilator {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  departmentCode: "CSE" | "ECE" | "EEE" | "MECH" | "CIVIL";
  designation: string;
  phone: string;
  assignedRoomsCount?: number;
  status: "AVAILABLE" | "ASSIGNED" | "ON_LEAVE";
}

export interface Room {
  id: string;
  roomNumber: string; // e.g. "101", "102"
  block: string;      // e.g. "A", "B"
  floor: number | string; // 1, "1st Floor"
  benchCount: number; // default 24
  seatsPerBench: number; // default 2
  capacity: number;   // benchCount * seatsPerBench
  isActive: boolean;
}

export interface Bench {
  id: string;
  roomId: string;
  benchNumber: number;
  seats: Seat[];
}

export interface Seat {
  id: string;
  benchId: string;
  seatNumber: number; // 1 (Left), 2 (Right)
}

export interface Exam {
  id: string;
  examCode: string;
  title: string;
  departmentCodes: Array<"CSE" | "ECE" | "EEE" | "MECH" | "CIVIL">;
  date: string;       // e.g. "2026-09-15"
  startTime: string;  // e.g. "10:00 AM"
  endTime: string;    // e.g. "01:00 PM"
  session: "MORNING" | "AFTERNOON";
  semester: number;
  academicYear: string;
  status: "DRAFT" | "SCHEDULED" | "ALLOCATED" | "IN_PROGRESS" | "COMPLETED";
  totalCandidates: number;
}

export interface StudentAllocation {
  id: string;
  examId: string;
  studentId: string;
  studentRoll: string;
  studentName: string;
  departmentCode: "CSE" | "ECE" | "EEE" | "MECH" | "CIVIL";
  roomId: string;
  roomNumber: string;
  block: string;
  benchNumber: number;
  seatNumber: number; // 1 or 2
  isPresent?: boolean;
  subjectCode?: string;
  subjectName?: string;
  semester?: number;
}

export interface InvigilatorAllocation {
  id: string;
  examId: string;
  invigilatorId: string;
  invigilatorName: string;
  invigilatorEmail: string;
  employeeId: string;
  roomId: string;
  roomNumber: string;
  block: string;
  assignedTime: string;
}

export interface BenchAllocation {
  benchNumber: number;
  rowIndex?: number;
  colIndex?: number;
  seat1?: StudentAllocation;
  seat2?: StudentAllocation;
  isMixedBranch: boolean;
  hasConflict: boolean;
  isSemSingleSeater?: boolean;
}

export interface RoomSeatingMatrix {
  roomId: string;
  roomNumber: string;
  block: string;
  totalBenches: number;
  allocatedCount: number;
  capacity: number;
  examType?: "MID" | "SEM";
  examSubdivision?: "MID_1" | "MID_2" | "REGULAR" | "SUPPLEMENTARY";
  seatsPerBench?: number;
  arrangementDirection?: "COLUMN_WISE" | "ROW_WISE" | "SNAKE_COLUMN" | "SNAKE_ROW";
  benches: BenchAllocation[];
}

export interface AllocationSummary {
  examId: string;
  examTitle: string;
  totalAllocated: number;
  totalRoomsUsed: number;
  branchMixingCompliance: number; // percentage e.g. 96.5%
  arrangementDirection?: "COLUMN_WISE" | "ROW_WISE" | "SNAKE_COLUMN" | "SNAKE_ROW";
  questionPaperBreakdown?: Record<string, number>;
  warnings: string[];
}
