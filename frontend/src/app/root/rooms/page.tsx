"use client";

import React, { useState, useEffect } from "react";
import {
  DoorOpen,
  Plus,
  Building,
  Users,
  Grid3X3,
  Sliders,
  Trash2,
  Edit2,
  X,
  Eye,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { api, ApiRoom } from "@/lib/api";
import { Room } from "@/types";

export default function RootRoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [previewRoom, setPreviewRoom] = useState<Room | null>(null);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    roomNumber: "",
    block: "A",
    floor: 1,
    benchCount: 24,
    seatsPerBench: 2,
  });

  const loadRooms = async () => {
    setLoading(true);
    try {
      const data: ApiRoom[] = await api.rooms.list();
      const mapped: Room[] = data.map((r) => ({
        id: String(r.id),
        roomNumber: r.room_number,
        block: r.block,
        floor: r.floor,
        benchCount: r.total_benches,
        seatsPerBench: r.seats_per_bench,
        capacity: r.total_benches * r.seats_per_bench,
        isActive: r.status === "AVAILABLE",
      }));
      setRooms(mapped);
    } catch (err) {
      console.error("Failed to load rooms:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.roomNumber) return;

    setIsSubmitting(true);
    setFormError("");

    try {
      await api.rooms.create({
        room_number: formData.roomNumber.trim(),
        block: formData.block.trim().toUpperCase(),
        floor: Number(formData.floor),
        total_benches: Number(formData.benchCount),
        seats_per_bench: Number(formData.seatsPerBench),
      });

      setIsAddModalOpen(false);
      setFormData({
        roomNumber: "",
        block: "A",
        floor: 1,
        benchCount: 24,
        seatsPerBench: 2,
      });
      await loadRooms();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to create examination room.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Examination Halls & Benches
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
              {rooms.length} Database Halls
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real physical examination halls and bench configurations from the GKCE database. Standard: 24 benches × 2 seats = 48 students.
          </p>
        </div>

        <button
          onClick={() => {
            setFormError("");
            setIsAddModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-sm transition self-start md:self-auto"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Examination Hall
        </button>
      </div>

      {/* Room Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">Loading examination halls...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                      Block {room.block} • Floor {room.floor}
                    </span>
                    <h3 className="text-xl font-extrabold text-slate-900 mt-2">
                      Room {room.roomNumber}
                    </h3>
                  </div>
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" title="Active" />
                </div>

                {/* Bench metrics */}
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-slate-400 text-[10px]">Benches</span>
                    <p className="font-bold text-slate-900 text-sm">
                      {room.benchCount}
                    </p>
                  </div>
                  <div className="p-2 rounded-xl bg-blue-50/60 border border-blue-200/80">
                    <span className="text-blue-600 text-[10px] font-medium">Capacity</span>
                    <p className="font-bold text-blue-700 text-sm">
                      {room.capacity} Seats
                    </p>
                  </div>
                </div>

                <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1">
                  <Sliders className="h-3 w-3" />
                  {room.seatsPerBench} seats per bench (Left / Right)
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => setPreviewRoom(room)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Inspect 24-Bench Grid
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Room Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Configure Examination Room
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAddRoom} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">
                    Room Number
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 301"
                    value={formData.roomNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, roomNumber: e.target.value })
                    }
                    className="mt-1 w-full p-2 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">
                    Block Identifier
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. A"
                    value={formData.block}
                    onChange={(e) =>
                      setFormData({ ...formData, block: e.target.value })
                    }
                    className="mt-1 w-full p-2 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">
                    Floor
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={formData.floor}
                    onChange={(e) =>
                      setFormData({ ...formData, floor: Number(e.target.value) })
                    }
                    className="mt-1 w-full p-2 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">
                    Total Benches
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={formData.benchCount}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        benchCount: Number(e.target.value),
                      })
                    }
                    className="mt-1 w-full p-2 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">
                    Seats / Bench
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={4}
                    value={formData.seatsPerBench}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        seatsPerBench: Number(e.target.value),
                      })
                    }
                    className="mt-1 w-full p-2 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? "Creating..." : "Save Hall"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inspect Bench Grid Modal */}
      {previewRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Room {previewRoom.roomNumber} Physical Layout
                </h3>
                <p className="text-xs text-slate-500">
                  Block {previewRoom.block} • Floor {previewRoom.floor} • {previewRoom.benchCount} Benches (4 Columns × 6 Rows)
                </p>
              </div>
              <button
                onClick={() => setPreviewRoom(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Blackboard indicator */}
            <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-center text-xs font-mono font-bold tracking-widest uppercase shadow-xs">
              ▲ INSTRUCTOR DESK & BLACKBOARD ▲
            </div>

            {/* Simulated 4x6 matrix */}
            <div className="grid grid-cols-4 gap-3 py-2">
              {Array.from({ length: previewRoom.benchCount }).map((_, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-slate-200 bg-white hover:border-blue-400 text-center space-y-1.5 shadow-2xs transition"
                >
                  <div className="font-mono font-bold text-xs text-slate-800">
                    Bench {idx + 1}
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    <div className="p-1 rounded bg-slate-50 border border-slate-200 font-mono text-slate-700 font-medium">
                      S1
                    </div>
                    <div className="p-1 rounded bg-slate-50 border border-slate-200 font-mono text-slate-700 font-medium">
                      S2
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setPreviewRoom(null)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
