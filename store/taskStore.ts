import { create } from "zustand";

export type TaskRoleCategory = "operator" | "manager" | "general" | "system";
export type TaskStatus = "pending" | "in-progress" | "blocked" | "completed" | "cancelled";
export type TaskPriority = "urgent" | "high" | "normal" | "low";

export interface TaskChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  roleCategory: TaskRoleCategory;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo: string;
  assignedBy?: string;
  department?: string;
  createdAt: string;
  dueDate: string;
  shift?: "Morning" | "Evening" | "Night" | "All";
  
  // Linked ERP entities
  relatedType?: "work-order" | "client-order" | "machine" | "customer" | "general";
  relatedId?: string;
  relatedName?: string;
  
  checklist: TaskChecklistItem[];
  notes?: string;
}

export const INITIAL_TASKS: TaskItem[] = [
  {
    id: "TSK-0101",
    title: "Approve color proof deviation (Delta-E 2.8) for Alpha Media",
    description: "Client requested inspection of Spot UV and PMS 871 Metallic alignment before run starts on Speedmaster XL 106.",
    roleCategory: "manager",
    status: "in-progress",
    priority: "urgent",
    assignedTo: "Alexey Kovalev",
    assignedBy: "K. Anderson (Prepress)",
    department: "Production Management",
    createdAt: "2026-10-06 08:30",
    dueDate: "2026-10-06 14:00",
    shift: "Morning",
    relatedType: "work-order",
    relatedId: "WOOF-26-0351",
    relatedName: "Hardcover Catalog 96p",
    checklist: [
      { id: "c1", text: "Inspect spectrophotometer Delta-E readings", completed: true },
      { id: "c2", text: "Verify client digital sign-off in portal", completed: true },
      { id: "c3", text: "Sign physical press approval sheet", completed: false },
    ],
  },
  {
    id: "TSK-0102",
    title: "Inspect doctor blades & blanket wash on Heidelberg XL 106",
    description: "Routine 50,000 imp check and solvent residue inspection before catalog run #WOOF-26-0351.",
    roleCategory: "operator",
    status: "pending",
    priority: "high",
    assignedTo: "M. Ivanova (Press)",
    assignedBy: "Alexey Kovalev",
    department: "Press Dept",
    createdAt: "2026-10-06 09:15",
    dueDate: "2026-10-06 11:30",
    shift: "Morning",
    relatedType: "machine",
    relatedId: "MCH-01",
    relatedName: "Heidelberg Speedmaster XL 106",
    checklist: [
      { id: "c1", text: "Inspect edge wear on steel blades", completed: false },
      { id: "c2", text: "Clean washup trays and sensors", completed: false },
      { id: "c3", text: "Calibrate fountain solution conductivity", completed: false },
    ],
  },
  {
    id: "TSK-0103",
    title: "Verify advance payment receipt from MegaCorp for CO-00043",
    description: "50% deposit required prior to releasing packaging carton substrates from bonded warehouse.",
    roleCategory: "general",
    status: "pending",
    priority: "high",
    assignedTo: "Sales Manager",
    assignedBy: "Administrator",
    department: "Sales & Client Service",
    createdAt: "2026-10-06 09:40",
    dueDate: "2026-10-06 16:00",
    shift: "All",
    relatedType: "client-order",
    relatedId: "CO-00041",
    relatedName: "Alpha Media — Catalog",
    checklist: [
      { id: "c1", text: "Check bank transit statement", completed: false },
      { id: "c2", text: "Update payment status in 1C ledger", completed: false },
    ],
  },
  {
    id: "TSK-0104",
    title: "Prepare PMS 871 Metallic Gold ink mix (12 kg)",
    description: "Blend pantone metallic base with trans-white according to formula sheet SPEC-0032.",
    roleCategory: "operator",
    status: "in-progress",
    priority: "normal",
    assignedTo: "A. Becker (Lamination)",
    assignedBy: "Alexey Kovalev",
    department: "Press Dept",
    createdAt: "2026-10-06 10:00",
    dueDate: "2026-10-06 13:00",
    shift: "Morning",
    relatedType: "work-order",
    relatedId: "WOOF-26-0351",
    relatedName: "Hardcover Catalog 96p",
    checklist: [
      { id: "c1", text: "Verify viscosimeter reading (25s DIN 4)", completed: true },
      { id: "c2", text: "Log batch barcode in warehouse outtake", completed: false },
    ],
  },
  {
    id: "TSK-0105",
    title: "Sign off emergency overtime for Flexo night shift crew",
    description: "High backlog on self-adhesive label lines requires 3 additional operators on shift #3.",
    roleCategory: "manager",
    status: "pending",
    priority: "urgent",
    assignedTo: "Alexey Kovalev",
    assignedBy: "S. Petrov (Die-cut)",
    department: "Production Management",
    createdAt: "2026-10-06 11:10",
    dueDate: "2026-10-06 15:00",
    shift: "Evening",
    relatedType: "general",
    checklist: [
      { id: "c1", text: "Review operator shift log and safety hours", completed: false },
      { id: "c2", text: "Submit electronic approval to HR portal", completed: false },
    ],
  },
  {
    id: "TSK-0106",
    title: "Follow up with Nordic Print Co regarding catalog quote QUO-892",
    description: "Follow up on pricing options with client procurement director; offer 3% volume discount on 10k copies.",
    roleCategory: "general",
    status: "in-progress",
    priority: "normal",
    assignedTo: "Elena Voronina",
    assignedBy: "Elena Voronina",
    department: "Sales & Client Service",
    createdAt: "2026-10-05 14:00",
    dueDate: "2026-10-06 17:00",
    shift: "All",
    relatedType: "customer",
    relatedId: "CST-1001",
    relatedName: "Nordic Print Co",
    checklist: [
      { id: "c1", text: "Prepare revised specification PDF", completed: true },
      { id: "c2", text: "Schedule telephone call for 15:30", completed: true },
      { id: "c3", text: "Log call summary in CRM activity log", completed: false },
    ],
  },
  {
    id: "TSK-0107",
    title: "Calibrate optical registration sensors on Bobst Novacut 106",
    description: "Precision alignment check for high-speed hot foil stamping and die-cutting.",
    roleCategory: "operator",
    status: "completed",
    priority: "normal",
    assignedTo: "S. Petrov (Die-cut)",
    assignedBy: "Alexey Kovalev",
    department: "Finishing Dept",
    createdAt: "2026-10-05 08:00",
    dueDate: "2026-10-05 12:00",
    shift: "Morning",
    relatedType: "machine",
    relatedId: "MCH-04",
    relatedName: "Bobst Novacut 106 Die-Cutter",
    checklist: [
      { id: "c1", text: "Clean optical emitter lenses", completed: true },
      { id: "c2", text: "Run 50-sheet test registration pass", completed: true },
      { id: "c3", text: "Record tolerance log (< 0.15 mm)", completed: true },
    ],
  },
  {
    id: "TSK-0108",
    title: "Paper Stock Shortage Verification: Arctic Silk 150g",
    description: "Warehouse indicates discrepancy of 4 reams for scheduled WOOF-26-0352 print job. Physical audit required.",
    roleCategory: "manager",
    status: "blocked",
    priority: "urgent",
    assignedTo: "Administrator",
    assignedBy: "Supervisor",
    department: "Warehouse & Supply",
    createdAt: "2026-10-06 07:45",
    dueDate: "2026-10-06 12:00",
    shift: "Morning",
    relatedType: "work-order",
    relatedId: "WOOF-26-0351",
    relatedName: "Arctic Silk 150g/m² Discrepancy",
    checklist: [
      { id: "c1", text: "Physically count pallet bays A3-12 and A3-14", completed: true },
      { id: "c2", text: "Verify incoming delivery slip from Antalis", completed: false },
      { id: "c3", text: "Authorize substitution stock if required", completed: false },
    ],
    notes: "Awaiting supplier confirmation on replacement pallet delivery.",
  },
];

interface TaskFilterState {
  searchQuery: string;
  roleCategory: "all" | "my" | TaskRoleCategory;
  status: "all" | TaskStatus;
  priority: "all" | TaskPriority;
  viewMode: "grid" | "board" | "calendar";
}

interface TaskStoreState {
  tasks: TaskItem[];
  filter: TaskFilterState;
  selectedTaskId: string | null;
  isCreateModalOpen: boolean;
  isDetailDialogOpen: boolean;

  // Actions
  setFilter: (filter: Partial<TaskFilterState>) => void;
  resetFilter: () => void;
  selectTask: (id: string | null) => void;
  setCreateModalOpen: (open: boolean) => void;
  setDetailDialogOpen: (open: boolean) => void;

  addTask: (task: Omit<TaskItem, "id" | "createdAt">) => TaskItem;
  updateTask: (id: string, updates: Partial<TaskItem>) => void;
  deleteTask: (id: string) => void;
  toggleChecklistItem: (taskId: string, checkId: string) => void;
  addChecklistItem: (taskId: string, text: string) => void;
  setTaskStatus: (id: string, status: TaskStatus) => void;
}

export const useTaskStore = create<TaskStoreState>((set, get) => ({
  tasks: INITIAL_TASKS,
  filter: {
    searchQuery: "",
    roleCategory: "all",
    status: "all",
    priority: "all",
    viewMode: "grid",
  },
  selectedTaskId: null,
  isCreateModalOpen: false,
  isDetailDialogOpen: false,

  setFilter: (newFilter) =>
    set((state) => ({ filter: { ...state.filter, ...newFilter } })),

  resetFilter: () =>
    set({
      filter: {
        searchQuery: "",
        roleCategory: "all",
        status: "all",
        priority: "all",
        viewMode: "grid",
      },
    }),

  selectTask: (id) =>
    set({
      selectedTaskId: id,
      isDetailDialogOpen: Boolean(id),
    }),

  setCreateModalOpen: (open) => set({ isCreateModalOpen: open }),
  setDetailDialogOpen: (open) =>
    set((state) => ({
      isDetailDialogOpen: open,
      selectedTaskId: open ? state.selectedTaskId : null,
    })),

  addTask: (taskData) => {
    const newId = `TSK-0${Math.floor(100 + Math.random() * 900)}`;
    const now = new Date();
    const createdAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const newTask: TaskItem = {
      ...taskData,
      id: newId,
      createdAt,
    };
    set((state) => ({ tasks: [newTask, ...state.tasks] }));
    return newTask;
  },

  updateTask: (id, updates) => {
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }));
  },

  deleteTask: (id) => {
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
      selectedTaskId: state.selectedTaskId === id ? null : state.selectedTaskId,
      isDetailDialogOpen: state.selectedTaskId === id ? false : state.isDetailDialogOpen,
    }));
  },

  toggleChecklistItem: (taskId, checkId) => {
    set((state) => ({
      tasks: state.tasks.map((task) => {
        if (task.id !== taskId) return task;
        return {
          ...task,
          checklist: task.checklist.map((item) =>
            item.id === checkId ? { ...item, completed: !item.completed } : item
          ),
        };
      }),
    }));
  },

  addChecklistItem: (taskId, text) => {
    if (!text.trim()) return;
    set((state) => ({
      tasks: state.tasks.map((task) => {
        if (task.id !== taskId) return task;
        const newItem: TaskChecklistItem = {
          id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          text: text.trim(),
          completed: false,
        };
        return {
          ...task,
          checklist: [...task.checklist, newItem],
        };
      }),
    }));
  },

  setTaskStatus: (id, status) => {
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, status } : t)),
    }));
  },
}));
