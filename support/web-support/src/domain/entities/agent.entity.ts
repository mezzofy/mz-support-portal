/**
 * Agent Entity — Support Console
 * The signed-in support-staff identity (from the STAFF session claim).
 */

export enum StaffTeam {
  SUPPORT = 'SUPPORT',
  SALES = 'SALES',
  FINANCE = 'FINANCE',
}

export interface Agent {
  agentId: string
  agentName: string
  email: string
  team?: StaffTeam | string
}
