export type DrawType = "Miercolito" | "Dominical" | "Gordito" | "Extraordinaria";

export type TicketStatus = "pending" | "win_1st" | "win_2nd" | "win_3rd" | "lose";

export interface Ticket {
  id: string;
  date: string; // YYYY-MM-DD
  draw: DrawType;
  number: string; // 2 or 4 digits
  status: TicketStatus;
  checked: boolean;
}

export interface UserStats {
  totalTickets: number;
  totalWins: number;
  totalMatchedDigits: number;
}

export interface GenerationRecord {
  id: string;
  date: string;
  draw: DrawType;
  strategy: string;
  timeRange: string;
  picks: string[];
}
