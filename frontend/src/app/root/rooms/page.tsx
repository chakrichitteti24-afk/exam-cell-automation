"use client";

import React, { useState, useEffect } from "react";
import {
  Plus,
  Sliders,
  Trash2,
  X,
  Eye,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  Building2,
  Armchair,
  Layers,
  Sparkles,
  CheckSquare,
  Square,
} from "lucide-react";
import { api, ApiRoom } from "@/lib/api";
import { Room } from "@/types";

export default function RootRoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBlock, setSelectedBlock] = useState("ALL");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [previewRoom, setPreviewRoom] = useState<Room | null>(null);
  const [deleteConfirmRoom, setDeleteConfirmRoom] = useState<Room | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Bulk select state ──────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [formData, setFormData] = useState({
    roomNumber: "",
    block: "Block A",
    floor: 1,
    benchCount: 24,
    seatsPerBench: 2,
  });

  const loadRooms = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
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
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function init() {
      try {
        const data: ApiRoom[] = await api.rooms.list();
        if (!ignore) {
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
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to load rooms:", err);
        if (!ignore) setLoading(false);
      }
    }
    init();
    return () => {
      ignore = true;
    };
  }, []);

  // Summary Metrics
  const totalHalls = rooms.length;
  const totalBenches = rooms.reduce((acc, r) => acc + r.benchCount, 0);
  const totalCapacity = rooms.reduce((acc, r) => acc + r.capacity, 0);
  const availableBlocks = Array.from(
    new Set(rooms.map((r) => (r.block.startsWith("Block") ? r.block : `Block ${r.block}`)))
  ).sort();

  // Filtered Rooms
  const filteredRooms = rooms.filter((r) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      r.roomNumber.toLowerCase().includes(q) ||
      r.block.toLowerCase().includes(q) ||
      String(r.floor).toLowerCase().includes(q);

    const blockFormatted = r.block.startsWith("Block") ? r.block : `Block ${r.block}`;
    const matchesBlock = selectedBlock === "ALL" || blockFormatted === selectedBlock;

    return matchesSearch && matchesBlock;
  });

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNumber = formData.roomNumber.trim();
    if (!cleanNumber) {
      setFormError("Room number is required.");
      return;
    }

    setIsSubmitting(true);
    setFormError("");
    setActionSuccess("");

    try {
      await api.rooms.create({
        room_number: cleanNumber,
        block: formData.block.trim() || "Block A",
        floor: Number(formData.floor),
        total_benches: Number(formData.benchCount) || 24,
        seats_per_bench: Number(formData.seatsPerBench) || 2,
        status: "AVAILABLE",
      });

      setIsAddModalOpen(false);
      setActionSuccess(`Examination Hall Room ${cleanNumber} created successfully.`);
      setFormData({
        roomNumber: "",
        block: "Block A",
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

  const handleDeleteRoom = async (room: Room) => {
    setDeletingId(room.id);
    setFormError("");
    setActionSuccess("");

    try {
      await api.rooms.delete(Number(room.id));
      setDeleteConfirmRoom(null);
      setActionSuccess(`Examination Hall Room ${room.roomNumber} and all its physical benches were permanently deleted.`);
      await loadRooms();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to delete examination room.");
    } finally {
      setDeletingId(null);
    }
  };

  // ── Bulk select helpers ────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allFilteredSelected =
    filteredRooms.length > 0 &&
    filteredRooms.every((r) => selectedIds.has(r.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredRooms.forEach((r) => next.delete(r.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredRooms.forEach((r) => next.add(r.id));
        return next;
      });
    }
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    setFormError("");
    setActionSuccess("");
    const ids = Array.from(selectedIds);
    let deleted = 0;
    let failed = 0;
    for (const id of ids) {
      try {
        await api.rooms.delete(Number(id));
        deleted++;
      } catch {
        failed++;
      }
    }
    setSelectedIds(new Set());
    setIsBulkDeleteOpen(false);
    setBulkDeleting(false);
    if (failed === 0) {
      setActionSuccess(`${deleted} examination hall${deleted !== 1 ? "s" : ""} permanently deleted.`);
    } else {
      setActionSuccess(`${deleted} deleted, ${failed} failed.`);
    }
    await loadRooms();
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
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
              {rooms.length} Database Halls
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real physical examination halls and bench configurations from the GKCE database. Standard: 24 benches × 2 seats = 48 candidates.
          </p>
        </div>

        <button
          onClick={() => {
            setFormError("");
            setFormData({
              roomNumber: "",
              block: "Block A",
              floor: 1,
              benchCount: 24,
              seatsPerBench: 2,
            });
            setIsAddModalOpen(true);
          }}
          className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-sm transition touch-target sm:touch-auto"
        >
          <Plus className="h-4 w-4" />
          Add Examination Hall
        </button>
      </div>

      {/* Summary KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-white/70 backdrop-blur-md border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-2 text-slate-500 text-xs">
            <Building2 className="h-4 w-4 text-blue-600" />
            <span>Active Halls</span>
          </div>
          <p className="mt-1 text-xl font-black text-slate-900">{totalHalls}</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-white/70 backdrop-blur-md border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-2 text-slate-500 text-xs">
            <Layers className="h-4 w-4 text-indigo-600" />
            <span>Total Benches</span>
          </div>
          <p className="mt-1 text-xl font-black text-slate-900">{totalBenches}</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-white/70 backdrop-blur-md border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-2 text-slate-500 text-xs">
            <Armchair className="h-4 w-4 text-emerald-600" />
            <span>Seating Capacity</span>
          </div>
          <p className="mt-1 text-xl font-black text-emerald-700">{totalCapacity} Seats</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-white/70 backdrop-blur-md border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-2 text-slate-500 text-xs">
            <Sparkles className="h-4 w-4 text-amber-600" />
            <span>Campus Blocks</span>
          </div>
          <p className="mt-1 text-xl font-black text-slate-900">
            {availableBlocks.length > 0 ? availableBlocks.length : 1}
          </p>
        </div>
      </div>

      {/* Action Success Alert */}
      {actionSuccess && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span className="font-medium">{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess("")}
            className="text-emerald-700 hover:text-emerald-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Global Form Error (outside modals) */}
      {formError && !isAddModalOpen && !deleteConfirmRoom && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span className="font-medium">{formError}</span>
          </div>
          <button
            onClick={() => setFormError("")}
            className="text-rose-700 hover:text-rose-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Search & Block Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white/60 backdrop-blur-md border border-slate-200 p-3 rounded-2xl">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search room number, block..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Filter Block:</span>
            <select
              value={selectedBlock}
              onChange={(e) => setSelectedBlock(e.target.value)}
              className="text-xs py-1.5 px-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="ALL">All Blocks</option>
              {availableBlocks.map((blk) => (
                <option key={blk} value={blk}>
                  {blk}
                </option>
              ))}
            </select>
          </div>

          {/* Select All toggle */}
          {filteredRooms.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
            >
              {allFilteredSelected ? (
                <CheckSquare className="h-3.5 w-3.5 text-blue-600" />
              ) : (
                <Square className="h-3.5 w-3.5 text-slate-400" />
              )}
              {allFilteredSelected ? "Deselect All" : "Select All"}
            </button>
          )}
        </div>
      </div>

      {/* Room Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <span>Loading examination halls...</span>
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-slate-300 bg-white/40 backdrop-blur-md">
          <Building2 className="h-8 w-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700">No Examination Halls Found</p>
          <p className="text-xs text-slate-400 mt-1">
            {searchQuery || selectedBlock !== "ALL"
              ? "Try adjusting your search query or block filter."
              : "Get started by adding your first examination hall."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {filteredRooms.map((room) => (
            <div
              key={room.id}
              className={`rounded-2xl border backdrop-blur-md p-5 shadow-2xs flex flex-col justify-between space-y-4 hover:border-slate-300 hover:shadow-xs transition ${
                selectedIds.has(room.id)
                  ? "bg-blue-50/50 border-blue-400 ring-1 ring-blue-400"
                  : "bg-white/70 border-slate-200"
              }`}
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2.5">
                    <button
                      onClick={() => toggleSelect(room.id)}
                      className="mt-1 text-slate-400 hover:text-blue-600 transition shrink-0"
                    >
                      {selectedIds.has(room.id) ? (
                        <CheckSquare className="h-4 w-4 text-blue-600" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                    <div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                        {room.block.startsWith("Block") ? room.block : `Block ${room.block}`} •{" "}
                        {String(room.floor).includes("Floor") ? room.floor : `Floor ${room.floor}`}
                      </span>
                      <h3 className="text-xl font-extrabold text-slate-900 mt-2">
                        Room {room.roomNumber}
                      </h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" title="Active Hall" />
                    <button
                      onClick={() => {
                        setFormError("");
                        setDeleteConfirmRoom(room);
                      }}
                      disabled={deletingId === room.id}
                      title={`Delete Room ${room.roomNumber}`}
                      aria-label={`Delete Room ${room.roomNumber}`}
                      className="inline-flex items-center justify-center h-7 w-7 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:border-rose-300 transition disabled:opacity-40 shrink-0"
                    >
                      {deletingId === room.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Bench metrics */}
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-slate-400 text-[10px]">Benches</span>
                    <p className="font-bold text-slate-900 text-sm">{room.benchCount}</p>
                  </div>
                  <div className="p-2 rounded-xl bg-blue-50/60 border border-blue-200/80">
                    <span className="text-blue-600 text-[10px] font-medium">Capacity</span>
                    <p className="font-bold text-blue-700 text-sm">{room.capacity} Seats</p>
                  </div>
                </div>

                <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1">
                  <Sliders className="h-3 w-3" />
                  {room.seatsPerBench} {room.seatsPerBench === 1 ? "seat" : "seats"} per bench
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => setPreviewRoom(room)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Inspect Grid Layout
                </button>
                <button
                  onClick={() => {
                    setFormError("");
                    setDeleteConfirmRoom(room);
                  }}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Hall
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Room Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Configure Examination Room
              </h3>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setFormError("");
                }}
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

            <form onSubmit={handleAddRoom} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Room Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 301"
                    value={formData.roomNumber}
                    onChange={(e) => {
                      setFormData({ ...formData, roomNumber: e.target.value });
                      if (formError) setFormError("");
                    }}
                    className="mt-1 w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Block Identifier</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Block A"
                    value={formData.block}
                    onChange={(e) =>
                      setFormData({ ...formData, block: e.target.value })
                    }
                    className="mt-1 w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Floor</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={formData.floor}
                    onChange={(e) =>
                      setFormData({ ...formData, floor: Number(e.target.value) })
                    }
                    className="mt-1 w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Total Benches</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={formData.benchCount}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        benchCount: Math.max(1, Number(e.target.value)),
                      })
                    }
                    className="mt-1 w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Seats / Bench</label>
                  <input
                    type="number"
                    min={1}
                    max={4}
                    value={formData.seatsPerBench}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        seatsPerBench: Math.max(1, Number(e.target.value)),
                      })
                    }
                    className="mt-1 w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
                  />
                </div>
              </div>

              {/* Dynamic Capacity Preview */}
              <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-200 text-blue-900 flex items-center justify-between">
                <div>
                  <span className="font-bold block text-xs">Calculated Hall Capacity</span>
                  <span className="text-[11px] text-blue-700">
                    {formData.benchCount} benches × {formData.seatsPerBench} seats/bench (4 columns × {Math.ceil(formData.benchCount / 4)} rows)
                  </span>
                </div>
                <div className="text-base font-black text-blue-800">
                  {formData.benchCount * formData.seatsPerBench} Seats
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setFormError("");
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium"
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
          <div className="bg-white/95 backdrop-blur-xl border border-slate-200 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Room {previewRoom.roomNumber} Physical Layout
                </h3>
                <p className="text-xs text-slate-500">
                  {previewRoom.block.startsWith("Block") ? previewRoom.block : `Block ${previewRoom.block}`} •{" "}
                  {String(previewRoom.floor).includes("Floor") ? previewRoom.floor : `Floor ${previewRoom.floor}`} •{" "}
                  {previewRoom.benchCount} Benches (4 Columns × {Math.ceil(previewRoom.benchCount / 4)} Rows) •{" "}
                  {previewRoom.capacity} Total Candidates
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

            {/* Matrix of Benches */}
            <div className="overflow-x-auto pb-2 -mx-1 px-1 no-scrollbar">
              <div className="min-w-[420px] sm:min-w-0 grid grid-cols-4 gap-2 sm:gap-3 py-2">
                {Array.from({ length: previewRoom.benchCount }).map((_, idx) => {
                  const sPerBench = previewRoom.seatsPerBench || 2;
                  const gridColsClass =
                    sPerBench === 1
                      ? "grid-cols-1"
                      : sPerBench === 3
                      ? "grid-cols-3"
                      : sPerBench === 4
                      ? "grid-cols-4"
                      : "grid-cols-2";

                  return (
                    <div
                      key={idx}
                      className="p-2.5 sm:p-3 rounded-xl border border-slate-200 bg-white/80 backdrop-blur-sm hover:border-blue-400 text-center space-y-1.5 shadow-2xs transition"
                    >
                      <div className="font-mono font-bold text-xs text-slate-800">
                        Bench {idx + 1}
                      </div>
                      <div className={`grid ${gridColsClass} gap-1 text-[10px]`}>
                        {Array.from({ length: sPerBench }).map((_, sIdx) => (
                          <div
                            key={sIdx}
                            className="p-1 rounded bg-slate-50 border border-slate-200 font-mono text-slate-700 font-medium"
                          >
                            S{sIdx + 1}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
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

      {/* Delete Confirmation Modal */}
      {deleteConfirmRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-600">
                <div className="h-8 w-8 rounded-xl bg-rose-100 flex items-center justify-center">
                  <Trash2 className="h-4 w-4 text-rose-600" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Delete Examination Hall
                </h3>
              </div>
              <button
                onClick={() => {
                  setDeleteConfirmRoom(null);
                  setFormError("");
                }}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            <p className="text-xs text-slate-600">
              Are you sure you want to permanently delete{" "}
              <strong className="text-slate-900">Room {deleteConfirmRoom.roomNumber}</strong>?
            </p>

            <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200 text-rose-800 text-[11px] space-y-1">
              <p className="font-semibold">This action will immediately remove:</p>
              <ul className="list-disc list-inside space-y-0.5 text-rose-700">
                <li>
                  Physical room record ({deleteConfirmRoom.block.startsWith("Block") ? deleteConfirmRoom.block : `Block ${deleteConfirmRoom.block}`},{" "}
                  {String(deleteConfirmRoom.floor).includes("Floor") ? deleteConfirmRoom.floor : `Floor ${deleteConfirmRoom.floor}`})
                </li>
                <li>All {deleteConfirmRoom.benchCount} physical benches and {deleteConfirmRoom.capacity} candidate seats</li>
                <li>Any student allocations or attendance records linked to this hall</li>
              </ul>
            </div>

            <div className="pt-2 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmRoom(null);
                  setFormError("");
                }}
                disabled={deletingId === deleteConfirmRoom.id}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteRoom(deleteConfirmRoom)}
                disabled={deletingId === deleteConfirmRoom.id}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {deletingId === deleteConfirmRoom.id ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
          <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 shadow-2xl rounded-2xl px-5 py-3 flex items-center gap-4">
            <span className="text-white text-xs font-medium">
              <strong className="text-blue-400">{selectedIds.size}</strong> examination hall{selectedIds.size !== 1 && "s"} selected
            </span>
            <div className="h-4 w-px bg-slate-700 mx-2" />
            <button
              onClick={() => setIsBulkDeleteOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500 hover:text-white transition text-xs font-semibold"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Selected
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="p-1.5 text-slate-400 hover:text-white transition ml-2"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {isBulkDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-600">
                <div className="h-8 w-8 rounded-xl bg-rose-100 flex items-center justify-center">
                  <Trash2 className="h-4 w-4 text-rose-600" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Delete Multiple Halls
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsBulkDeleteOpen(false);
                  setFormError("");
                }}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            <p className="text-xs text-slate-600">
              Are you sure you want to permanently delete{" "}
              <strong className="text-slate-900">{selectedIds.size} selected examination halls</strong>?
            </p>

            <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200 text-rose-800 text-[11px] space-y-1">
              <p className="font-semibold">This action will immediately remove:</p>
              <ul className="list-disc list-inside space-y-0.5 text-rose-700">
                <li>All selected physical room records</li>
                <li>All associated physical benches and candidate seats</li>
                <li>Any student allocations or attendance records linked to these halls</li>
              </ul>
            </div>

            <div className="pt-2 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setIsBulkDeleteOpen(false);
                  setFormError("");
                }}
                disabled={bulkDeleting}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {bulkDeleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Confirm Delete All</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
