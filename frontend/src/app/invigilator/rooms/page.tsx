"use client";

import React, { useState, useEffect } from "react";
import {
  DoorOpen,
  ShieldCheck,
  ShieldAlert,
  Lock,
  CheckCircle2,
  Users,
  Search,
} from "lucide-react";
import { RoomSeatingGrid } from "@/components/seating/RoomSeatingGrid";
import { api, ApiDutyAssignment, ApiRoom, mapApiMatrixToRoomMatrix } from "@/lib/api";
import { RoomSeatingMatrix } from "@/types";

export default function InvigilatorRoomsPage() {
  const [rooms, setRooms] = useState<ApiRoom[]>([]);
  const [duties, setDuties] = useState<ApiDutyAssignment[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [matrix, setMatrix] = useState<RoomSeatingMatrix | null>(null);
  const [isAccessDenied, setIsAccessDenied] = useState(false);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const [rmList, dutyList] = await Promise.all([
          api.rooms.list(),
          api.invigilators.myDuties(),
        ]);
        setRooms(rmList);
        setDuties(dutyList);

        if (dutyList.length > 0) {
          setSelectedRoomId(dutyList[0].room_id);
        } else if (rmList.length > 0) {
          setSelectedRoomId(rmList[0].id);
        }
      } catch (err) {
        console.error("Failed to load rooms or duties:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  useEffect(() => {
    async function fetchMatrixForRoom() {
      if (!selectedRoomId || duties.length === 0) return;
      const examId = duties[0].exam_id;

      try {
        const apiMatrix = await api.allocation.getRoomMatrix(selectedRoomId, examId);
        setMatrix(mapApiMatrixToRoomMatrix(apiMatrix, examId));
        setIsAccessDenied(false);
        setAccessDeniedMessage("");
      } catch (err: unknown) {
        const error = err as { status?: number; message?: string };
        if (error.status === 403 || (error.message && error.message.includes("Access Denied"))) {
          setIsAccessDenied(true);
          setAccessDeniedMessage(error.message || "403 Forbidden: Sandboxed strictly to your assigned examination room.");
        } else {
          setIsAccessDenied(true);
          setAccessDeniedMessage(error.message || "Access restricted.");
        }
        setMatrix(null);
      }
    }

    fetchMatrixForRoom();
  }, [selectedRoomId, duties]);

  const assignedRoomId = duties.length > 0 ? duties[0].room_id : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Assigned Room Seating Roster
          </h1>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
            Resource-Level Authorization
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Supervise seating allocation, verify bench labels, and confirm identity of candidates in your assigned room.
        </p>
      </div>

      {/* Room Selector with Security Indicators */}
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-2xl border border-slate-200 bg-white shadow-xs">
        <span className="text-xs font-bold text-slate-700">
          Select Examination Hall:
        </span>

        {rooms.map((room) => {
          const isDutyRoom = room.id === assignedRoomId;
          const isSelected = selectedRoomId === room.id;

          return (
            <button
              key={room.id}
              onClick={() => setSelectedRoomId(room.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                isSelected
                  ? isDutyRoom
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-rose-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {isDutyRoom ? (
                <ShieldCheck className="h-3.5 w-3.5 text-blue-200" />
              ) : (
                <Lock className="h-3.5 w-3.5 text-rose-500" />
              )}
              Room {room.room_number} {isDutyRoom ? "(Assigned Duty)" : "(Other Hall)"}
            </button>
          );
        })}
      </div>

      {/* Authorization Check Enforcement */}
      {!isAccessDenied && matrix ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>
              <strong>Access Granted:</strong> You are the verified duty invigilator for <strong>Room {matrix.roomNumber} (Block {matrix.block})</strong>. Candidate roster and real-time attendance controls are active.
            </span>
          </div>

          <RoomSeatingGrid matrix={matrix} interactive={true} />
        </div>
      ) : isAccessDenied ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-12 text-center space-y-4 shadow-xs">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 shadow-inner">
            <ShieldAlert className="h-8 w-8" />
          </div>

          <div className="space-y-1">
            <h3 className="text-xl font-black text-rose-900">
              403 Forbidden — Hall Access Restricted
            </h3>
            <p className="text-xs text-rose-700 max-w-md mx-auto">
              {accessDeniedMessage || "You are not authorized to inspect seating allocations in this examination hall. Faculty invigilators are sandboxed strictly to their assigned duties."}
            </p>
          </div>

          <div className="pt-2">
            {assignedRoomId && (
              <button
                onClick={() => setSelectedRoomId(assignedRoomId)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-500/20 transition"
              >
                <DoorOpen className="h-4 w-4" />
                <span>Return to Assigned Duty Room</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="p-12 text-center text-xs text-slate-400">
          Loading room roster...
        </div>
      )}
    </div>
  );
}
