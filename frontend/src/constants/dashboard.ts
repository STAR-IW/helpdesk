export interface DashboardStats {
  totalTickets: number
  openTickets: number
  aiResolvedTickets: number
  aiResolvedPercent: number
  avgResolutionSeconds: number | null
}

export interface DailyTicketCount {
  // UTC calendar day, YYYY-MM-DD
  date: string
  count: number
}
