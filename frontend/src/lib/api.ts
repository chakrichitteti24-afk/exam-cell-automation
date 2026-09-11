/**
 * GKCE Exam Cell Automation System — API Client
 * Authentic FastAPI + SQLite Backend Integration
 */

import { RoomSeatingMatrix } from "@/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";
const TOKEN_KEY = "gkce_exam_cell_auth_token";

export interface ApiTokenResponse {
  access_token: string;
  token_type: string;
  role: "ROOT" | "INVIGILATOR" | "STUDENT";
  user_id: number;
  email: string;
  full_name: string;
  identifier: string;
}

export interface ApiUserProfile {
  id: number;
  email: string;
  username: string;
  role: "ROOT" | "INVIGILATOR" | "STUDENT";
  full_name: string;
  is_active: boolean;
}

export interface ApiDepartment {
  id: number;
  code: string;
  name: string;
}

export interface ApiStudent {
  id: number;
  roll_number: string;
  name: string;
  department_id: number;
  department_code?: string;
  semester: number;
  section: string;
  academic_year: string;
  email: string;
  phone?: string;
  user_id?: number;
}

export interface ApiRoom {
  id: number;
  room_number: string;
  block: string;
  floor: number;
  total_benches: number;
  seats_per_bench: number;
  capacity: number;
  status: string;
  benches_count: number;
}

export interface ApiInvigilator {
  id: number;
  user_id?: number;
  faculty_id: string;
  name: string;
  department_id: number;
  department_code?: string;
  designation: string;
  email: string;
  phone?: string;
  assigned_room?: string;
}

export interface ApiDutyAssignment {
  id: number;
  exam_id: number;
  subject_code: string;
  subject_name: string;
  exam_date: string;
  time_slot: string;
  room_id: number;
  room_number: string;
  block: string;
  total_students: number;
  present_count: number;
  absent_count: number;
}

export interface ApiExam {
  id: number;
  subject_code: string;
  subject_name: string;
  exam_date: string;
  start_time: string;
  end_time: string;
  session: string;
  academic_year: string;
  semester: number;
  exam_type?: "MID" | "SEM";
  exam_subdivision?: "MID_1" | "MID_2" | "REGULAR" | "SUPPLEMENTARY";
  status: string;
  enrolled_students_count: number;
  allocated_students_count: number;
}

export interface ApiDutyRosterItem {
  room_id: number;
  room_number: string;
  block: string;
  invigilator_id: number;
  invigilator_name: string;
  faculty_id: string;
  department_code: string;
  total_candidates: number;
  is_alternative_fallback?: boolean;
}

export interface ApiExamLaunchResponse {
  message: string;
  status: string;
  total_students_allocated: number;
  rooms_utilized: number;
  branch_mixing_compliance_percent: number;
  duty_roster: ApiDutyRosterItem[];
  launched_exams?: ApiExam[];
}

export interface ApiSeatStudent {
  student_id: number;
  roll_number: string;
  name: string;
  department_code: string;
  seat_id: number;
  seat_number: number;
  seat_label: string;
  attendance_status?: string;
  subject_code?: string;
  subject_name?: string;
}

export interface ApiBenchSeating {
  bench_id: number;
  bench_number: number;
  row_index: number;
  col_index: number;
  seat1?: ApiSeatStudent | null;
  seat2?: ApiSeatStudent | null;
  is_mixed_branch: boolean;
  is_sem_single_seater?: boolean;
}

export interface ApiRoomSeatingMatrix {
  room_id: number;
  room_number: string;
  block: string;
  capacity: number;
  exam_type?: "MID" | "SEM";
  exam_subdivision?: "MID_1" | "MID_2" | "REGULAR" | "SUPPLEMENTARY";
  seats_per_bench?: number;
  allocated_count: number;
  benches_count: number;
  benches: ApiBenchSeating[];
  department_breakdown: Record<string, number>;
  mixing_compliance_percent: number;
}

export interface ApiStudentDeskSlip {
  student_id: number;
  roll_number: string;
  student_name: string;
  department_code: string;
  semester: number;
  academic_year: string;
  exam_id: number;
  subject_code: string;
  subject_name: string;
  exam_date: string;
  time_slot: string;
  room_id: number;
  room_number: string;
  block: string;
  floor: number;
  bench_number: number;
  seat_number: number;
  seat_label: string;
  exam_type?: "MID" | "SEM";
  exam_subdivision?: "MID_1" | "MID_2" | "REGULAR" | "SUPPLEMENTARY";
  partner_department?: string | null;
  partner_subject_code?: string | null;
  partner_subject_name?: string | null;
  qr_payload: string;
  total_benches?: number;
  row_index?: number;
  col_index?: number;
}

export interface ApiDoorNoticeStudent {
  seat_number: number;
  bench_number: number;
  roll_number: string;
  name: string;
  department: string;
}

export interface ApiDoorNoticeReport {
  institution_name: string;
  exam_title: string;
  subject_code: string;
  subject_name: string;
  exam_date: string;
  exam_type?: "MID" | "SEM";
  exam_subdivision?: "MID_1" | "MID_2" | "REGULAR" | "SUPPLEMENTARY";
  time_slot: string;
  room_number: string;
  block: string;
  total_candidates: number;
  benches_used: number;
  students: ApiDoorNoticeStudent[];
  chief_superintendent_signature: string;
}

export interface ApiAllocationSummary {
  total_students_allocated: number;
  total_active_exams: number;
  total_rooms_utilized: number;
  total_rooms_available: number;
  branch_mixing_compliance_percent: number;
  room_occupancy?: Record<number, number>;
}

export interface ApiAllocationRunSummary {
  exam_id: number;
  subject_code: string;
  exam_type?: "MID" | "SEM";
  exam_subdivision?: "MID_1" | "MID_2" | "REGULAR" | "SUPPLEMENTARY";
  seats_per_bench?: number;
  total_students_allocated: number;
  rooms_allocated_count?: number;
  rooms_utilized?: number;
  branch_mixing_compliance_percent: number;
  overflow_students_count?: number;
  arrangement_direction?: string;
  question_paper_breakdown?: Record<string, number>;
  warnings?: string[];
}

export const tokenStorage = {
  get: (): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
  },
  set: (token: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(TOKEN_KEY, token);
    }
  },
  clear: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(TOKEN_KEY);
    }
  },
};

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = tokenStorage.get();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = "An unexpected API error occurred.";
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || JSON.stringify(errJson);
    } catch {
      errorDetail = await response.text();
    }

    const isAuthLogin = endpoint.includes("/auth/login");
    const isUserNotFound = typeof errorDetail === "string" && errorDetail.toLowerCase().includes("user not found");
    if (!isAuthLogin && (response.status === 401 || isUserNotFound) && typeof window !== "undefined") {
      tokenStorage.clear();
      localStorage.removeItem("gkce_exam_cell_auth_session");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    const error = new Error(errorDetail);
    (error as unknown as { status: number }).status = response.status;
    throw error;
  }

  return response.json();
}

export const api = {
  auth: {
    login: (identifier: string, password: string): Promise<ApiTokenResponse> =>
      request<ApiTokenResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ identifier, password }),
      }),
    getMe: (): Promise<ApiUserProfile> => request<ApiUserProfile>("/auth/me"),
  },

  departments: {
    list: (): Promise<ApiDepartment[]> => request<ApiDepartment[]>("/departments/"),
  },

  students: {
    list: (params?: {
      department_id?: number;
      semester?: number;
      search?: string;
      skip?: number;
      limit?: number;
    }): Promise<ApiStudent[]> => {
      const query = new URLSearchParams();
      if (params?.department_id) query.append("department_id", String(params.department_id));
      if (params?.semester) query.append("semester", String(params.semester));
      if (params?.search) query.append("search", params.search);
      if (params?.skip !== undefined) query.append("skip", String(params.skip));
      if (params?.limit !== undefined) query.append("limit", String(params.limit));
      const qs = query.toString();
      return request<ApiStudent[]>(`/students/${qs ? `?${qs}` : ""}`);
    },

    create: (data: {
      roll_number: string;
      name: string;
      department_id: number;
      semester?: number;
      section?: string;
      academic_year?: string;
      email: string;
      phone?: string;
      password?: string;
    }): Promise<ApiStudent> =>
      request<ApiStudent>("/students/", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    importCSV: (file: File): Promise<{ total_records: number; imported_count: number; skipped_count: number; errors: string[] }> => {
      const formData = new FormData();
      formData.append("file", file);
      return request("/students/import-csv", {
        method: "POST",
        body: formData,
      });
    },
  },

  rooms: {
    list: (): Promise<ApiRoom[]> => request<ApiRoom[]>("/rooms/"),
    getLayout: (roomId: number): Promise<unknown> => request(`/rooms/${roomId}`),
    create: (data: {
      room_number: string;
      block: string;
      floor?: number;
      total_benches?: number;
      seats_per_bench?: number;
    }): Promise<ApiRoom> =>
      request<ApiRoom>("/rooms/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  invigilators: {
    list: (): Promise<ApiInvigilator[]> => request<ApiInvigilator[]>("/invigilators/"),
    create: (data: {
      faculty_id: string;
      name: string;
      department_id: number;
      designation?: string;
      email: string;
      phone?: string;
      password?: string;
    }): Promise<ApiInvigilator> =>
      request<ApiInvigilator>("/invigilators/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    assign: (data: {
      exam_id?: number;
      assignments?: { invigilator_id: number; room_id: number }[];
      auto_distribute?: boolean;
    }): Promise<{ message: string; assignments: any[] }> =>
      request<{ message: string; assignments: any[] }>("/invigilators/assign", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    myDuties: (): Promise<ApiDutyAssignment[]> =>
      request<ApiDutyAssignment[]>("/invigilators/my-duties"),
  },

  exams: {
    list: (): Promise<ApiExam[]> => request<ApiExam[]>("/exams/"),
    create: (data: {
      subject_code: string;
      subject_name: string;
      exam_date: string;
      start_time: string;
      end_time: string;
      session?: string;
      academic_year?: string;
      semester?: number;
      exam_type?: "MID" | "SEM";
      exam_subdivision?: "MID_1" | "MID_2" | "REGULAR" | "SUPPLEMENTARY";
      status?: string;
      eligible_department_ids?: number[];
    }): Promise<ApiExam> =>
      request<ApiExam>("/exams/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    launch: (data?: {
      exam_id?: number;
      exam_ids?: number[];
      room_ids?: number[];
      exam_type?: "MID" | "SEM";
      exam_subdivision?: "MID_1" | "MID_2" | "REGULAR" | "SUPPLEMENTARY";
      strategy?: string;
      arrangement_direction?: string;
      auto_assign_invigilators?: boolean;
    }): Promise<ApiExamLaunchResponse> =>
      request<ApiExamLaunchResponse>("/exams/launch", {
        method: "POST",
        body: JSON.stringify(data || {}),
      }),
  },

  allocation: {
    generate: (data: {
      exam_id?: number;
      exam_ids?: number[];
      room_ids?: number[];
      exam_type?: "MID" | "SEM";
      exam_subdivision?: "MID_1" | "MID_2" | "REGULAR" | "SUPPLEMENTARY";
      strategy?: string;
      arrangement_direction?: string;
    }): Promise<ApiAllocationRunSummary> =>
      request<ApiAllocationRunSummary>("/allocation/generate", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    getRoomMatrix: (roomId: number, examId: number): Promise<ApiRoomSeatingMatrix> =>
      request<ApiRoomSeatingMatrix>(`/allocation/room/${roomId}/exam/${examId}`),

    getMyDeskSlip: (): Promise<ApiStudentDeskSlip> =>
      request<ApiStudentDeskSlip>("/allocation/student/me"),

    getDoorNotice: (roomId: number, examId: number): Promise<ApiDoorNoticeReport> =>
      request<ApiDoorNoticeReport>(`/allocation/reports/door-notice/${roomId}/exam/${examId}`),

    getSummary: (): Promise<ApiAllocationSummary> =>
      request<ApiAllocationSummary>("/allocation/summary"),

    reset: (examId?: number): Promise<{ message: string }> =>
      request<{ message: string }>(`/allocation/reset${examId ? `?exam_id=${examId}` : ""}`, {
        method: "DELETE",
      }),
  },

  attendance: {
    mark: (data: {
      exam_id: number;
      student_id: number;
      room_id: number;
      status: "PRESENT" | "ABSENT" | "MALPRACTICE";
    }): Promise<{ success: boolean; student_id: number; status: string; marked_at: string }> =>
      request("/attendance/mark", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    getRoomSummary: (examId: number, roomId: number): Promise<unknown> =>
      request(`/attendance/exam/${examId}/room/${roomId}`),
  },
};

export function mapApiMatrixToRoomMatrix(apiM: ApiRoomSeatingMatrix, examId: number): RoomSeatingMatrix {
  const isSem = apiM.exam_type === "SEM";
  return {
    roomId: String(apiM.room_id),
    roomNumber: apiM.room_number,
    block: apiM.block,
    totalBenches: apiM.benches_count || apiM.benches.length,
    allocatedCount: apiM.allocated_count,
    capacity: apiM.capacity,
    examType: apiM.exam_type || "MID",
    examSubdivision: apiM.exam_subdivision || (isSem ? "REGULAR" : "MID_1"),
    seatsPerBench: apiM.seats_per_bench || (isSem ? 1 : 2),
    benches: apiM.benches.map((b) => {
      const s1 = b.seat1
        ? {
            id: `alloc-${examId}-${b.seat1.student_id}`,
            examId: String(examId),
            studentId: String(b.seat1.student_id),
            studentRoll: b.seat1.roll_number,
            studentName: b.seat1.name,
            departmentCode: (b.seat1.department_code || "N/A") as any,
            roomId: String(apiM.room_id),
            roomNumber: apiM.room_number,
            block: apiM.block,
            benchNumber: b.bench_number,
            seatNumber: b.seat1.seat_number,
            isPresent: b.seat1.attendance_status !== "ABSENT",
            subjectCode: b.seat1.subject_code,
            subjectName: b.seat1.subject_name,
          }
        : undefined;

      const s2 = b.seat2
        ? {
            id: `alloc-${examId}-${b.seat2.student_id}`,
            examId: String(examId),
            studentId: String(b.seat2.student_id),
            studentRoll: b.seat2.roll_number,
            studentName: b.seat2.name,
            departmentCode: (b.seat2.department_code || "N/A") as any,
            roomId: String(apiM.room_id),
            roomNumber: apiM.room_number,
            block: apiM.block,
            benchNumber: b.bench_number,
            seatNumber: b.seat2.seat_number,
            isPresent: b.seat2.attendance_status !== "ABSENT",
            subjectCode: b.seat2.subject_code,
            subjectName: b.seat2.subject_name,
          }
        : undefined;

      return {
        benchNumber: b.bench_number,
        rowIndex: b.row_index,
        colIndex: b.col_index,
        seat1: s1,
        seat2: s2,
        isMixedBranch: b.is_mixed_branch,
        hasConflict: false,
        isSemSingleSeater: b.is_sem_single_seater ?? isSem,
      };
    }),
  };
}
