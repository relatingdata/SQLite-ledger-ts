// Live Project + Milestone + the scheduling/contention engine, for the
// Project Builder tutorial. See docs/pm-project-builder.md.
//
// A Live Project is created once a multi-line Project Proposal
// (db-quotations.ts's widened Quotation, Stage 4) is accepted. Its
// Recipe lines (Labour/Plant kind, Stage 1's widened BOM mechanism —
// stageBomComponent/postBomComponents/getBomComponents, reused verbatim,
// just staged under the Project's own entity instead of an assembly
// item) each carry a DESIRED scheduledStart/durationHours from the
// proposal. scheduleProjectRecipeLines resolves each one's ACTUAL
// window via findNextAvailableWindow — which generalizes the real,
// already-proven overlap idiom in db.ts's own setEmployeeSchedule
// (`s.starts_at < other.ends_at && other.starts_at < s.ends_at`,
// db.ts:3247 at the time this was written) from time-of-day ranges to
// date ranges, and from "this employee's other shifts" to "this
// resource's Labour/Plant commitments across every OTHER live
// Project in the business" — pushing a line into the future on a real
// conflict, never blocking it, per direct instruction. Once every line
// has its real window, checkMilestoneAchievability flags (never blocks)
// a real `Schedule Risk` on the Project and its final Milestone if the
// resulting completion date falls after the client's own wanted date.
import { Entity } from './primitives.js';
import {
  ValidationError,
  requireEntity,
  create,
  typeRootName,
  typeBusinessName,
  typeBusinessLiveProjectsRootName,
  typeLiveProjectName,
  typeMilestoneName,
  stageBomComponent,
  postBomComponents,
  getBomComponents,
  type BusinessName,
  type UserId,
  type BomComponentLine,
} from './db.js';

function liveProjectsRoot(business: BusinessName) {
  return requireEntity('Live Projects', typeBusinessLiveProjectsRootName, requireEntity(business, typeBusinessName, requireEntity('Businesses', typeRootName)));
}

export function createLiveProject(
  name: string,
  business: BusinessName,
  client: string,
  requestedStart: string,
  targetCompletionDate: string,
  userId: UserId
): { id: number } {
  const root = liveProjectsRoot(business);
  if (Entity.getUnder(name, root.id)) throw new ValidationError(`A real Live Project named "${name}" already exists for "${business}".`);
  const entity = create(root, typeLiveProjectName, name, userId);
  Entity.setAttr(entity.id, 'Client', client, userId);
  Entity.setAttr(entity.id, 'Requested Start', requestedStart, userId);
  Entity.setAttr(entity.id, 'Target Completion Date', targetCompletionDate, userId);
  return entity;
}

export interface LiveProjectRecord {
  name: string;
  client: string;
  requestedStart: string;
  targetCompletionDate: string;
  scheduleRisk?: string;
}

export function getLiveProject(name: string): LiveProjectRecord | undefined {
  const entity = Entity.get(name);
  if (!entity) return undefined;
  const client = Entity.getAttr(entity.id, 'Client');
  if (client == null) return undefined;
  return {
    name,
    client,
    requestedStart: Entity.getAttr(entity.id, 'Requested Start') ?? '',
    targetCompletionDate: Entity.getAttr(entity.id, 'Target Completion Date') ?? '',
    scheduleRisk: Entity.getAttr(entity.id, 'Schedule Risk'),
  };
}

export function listLiveProjects(business: BusinessName): string[] {
  const root = liveProjectsRoot(business);
  return Entity.children(root.id).map((c) => c.name);
}

export type MilestoneType = 'Plans Submission' | 'Inspection' | 'Invoicing';

export function createMilestone(projectName: string, milestoneType: MilestoneType, dueDate: string, userId: UserId, label?: string): { id: number } {
  const project = requireEntity(projectName, typeLiveProjectName);
  const name = label ? `${projectName} — ${label}` : `${projectName} — ${milestoneType} — ${dueDate}`;
  const entity = create(project, typeMilestoneName, name, userId);
  Entity.setAttr(entity.id, 'Milestone Type', milestoneType, userId);
  Entity.setAttr(entity.id, 'Due Date', dueDate, userId);
  return entity;
}

export interface MilestoneRecord {
  name: string;
  milestoneType: MilestoneType;
  dueDate: string;
  scheduleRisk?: string;
}

export function getMilestones(projectName: string): MilestoneRecord[] {
  const project = Entity.get(projectName);
  if (!project) return [];
  return Entity.children(project.id)
    .map((c) => ({ id: c.id, name: c.name, milestoneType: Entity.getAttr(c.id, 'Milestone Type'), dueDate: Entity.getAttr(c.id, 'Due Date') }))
    .filter((m): m is { id: number; name: string; milestoneType: string; dueDate: string } => m.milestoneType != null && m.dueDate != null)
    .map((m) => ({ name: m.name, milestoneType: m.milestoneType as MilestoneType, dueDate: m.dueDate, scheduleRisk: Entity.getAttr(m.id, 'Schedule Risk') }));
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Math.ceil(days));
  return d.toISOString().slice(0, 10);
}

export interface ResourceBooking {
  project: string;
  start: string;
  end: string;
}

// Every real, currently-scheduled Labour/Plant commitment for a named
// resource, across every OTHER live Project in the business —
// `excludeProject` lets a project's own, not-yet-finalized lines be
// scheduled against everyone else's real commitments without
// conflicting with themselves.
export function getResourceBookings(resourceName: string, business: BusinessName, excludeProject?: string): ResourceBooking[] {
  const bookings: ResourceBooking[] = [];
  for (const project of listLiveProjects(business)) {
    if (project === excludeProject) continue;
    for (const line of getBomComponents(project)) {
      if (line.component !== resourceName) continue;
      if (line.kind !== 'Labour' && line.kind !== 'Plant') continue;
      if (!line.scheduledStart || !line.scheduledEnd) continue;
      bookings.push({ project, start: line.scheduledStart, end: line.scheduledEnd });
    }
  }
  return bookings;
}

export interface ScheduleResolution {
  start: string;
  end: string;
  pushedOut: boolean;
  conflictingProject?: string;
}

// The real overlap idiom at the heart of this engine — a direct
// generalization of setEmployeeSchedule's own
// `s.starts_at < other.ends_at && other.starts_at < s.ends_at`
// (db.ts) from time-of-day ranges to date ranges. Never blocks: on a
// real conflict, it jumps the window past whichever booking it hit and
// keeps scanning forward until it finds a genuinely clear one.
export function findNextAvailableWindow(resourceName: string, business: BusinessName, desiredStart: string, durationDays: number, excludeProject?: string): ScheduleResolution {
  const bookings = getResourceBookings(resourceName, business, excludeProject).sort((a, b) => a.start.localeCompare(b.start));
  let start = desiredStart;
  let pushedOut = false;
  let conflictingProject: string | undefined;
  let movedAgain = true;
  while (movedAgain) {
    movedAgain = false;
    const end = addDays(start, durationDays);
    for (const booking of bookings) {
      const overlaps = start < booking.end && booking.start < end;
      if (overlaps) {
        start = booking.end;
        pushedOut = true;
        conflictingProject = booking.project;
        movedAgain = true;
        break;
      }
    }
  }
  return { start, end: addDays(start, durationDays), pushedOut, conflictingProject };
}

export interface ScheduledLine extends BomComponentLine {
  pushedOut: boolean;
  conflictingProject?: string;
}

// Resolves every real Labour/Plant line's DESIRED window into its
// ACTUAL one, re-posting it via the exact same Stage-1 BOM mechanism
// (stageBomComponent/postBomComponents — a re-stage of the same
// component_item replaces its line in place, the same idiom BOM
// already uses for a revised quantity). Material lines are left
// untouched. Returns every resolved line, so a caller (acceptQuotation,
// or a tutorial step's own verify) can see exactly which lines, if any,
// were pushed out and by what.
export function scheduleProjectRecipeLines(projectName: string, business: BusinessName, userId: UserId): ScheduledLine[] {
  const lines = getBomComponents(projectName);
  const resolved: ScheduledLine[] = [];
  for (const line of lines) {
    if ((line.kind !== 'Labour' && line.kind !== 'Plant') || !line.scheduledStart || line.durationHours == null) {
      resolved.push({ ...line, pushedOut: false });
      continue;
    }
    const durationDays = Math.max(1, Math.ceil(line.durationHours / 8));
    const resolution = findNextAvailableWindow(line.component, business, line.scheduledStart, durationDays, projectName);
    stageBomComponent({
      assemblyItem: projectName,
      business,
      componentItem: line.component,
      quantity: line.quantity,
      unit: line.unit,
      kind: line.kind,
      durationHours: line.durationHours,
      scheduledStart: resolution.start,
      scheduledEnd: resolution.end,
    });
    resolved.push({ ...line, scheduledStart: resolution.start, scheduledEnd: resolution.end, pushedOut: resolution.pushedOut, conflictingProject: resolution.conflictingProject });
  }
  postBomComponents(projectName, business, userId);
  return resolved;
}

// Never blocks — sets a real, visible `Schedule Risk` attribute on the
// Project (and its final Milestone, if one exists) when the resolved
// completion date falls after the client's own Target Completion Date.
// Clearing a prior risk (every line now resolves on time) is handled
// the same way: the attribute is simply not re-set, and a caller that
// wants it gone can `Entity.clearAttr` directly — left to the caller,
// since re-running this never needs to "undo" anything it would
// otherwise leave stale.
export function checkMilestoneAchievability(projectName: string, userId: UserId): { achievable: boolean; completionDate: string; targetCompletionDate: string } {
  const project = getLiveProject(projectName);
  if (!project) throw new ValidationError(`No real Live Project named "${projectName}".`);
  const lines = getBomComponents(projectName);
  const ends = lines.map((l) => l.scheduledEnd).filter((e): e is string => !!e);
  const completionDate = ends.length > 0 ? ends.sort().at(-1)! : project.requestedStart;
  const achievable = completionDate <= project.targetCompletionDate;
  const projectEntity = Entity.get(projectName)!;
  if (!achievable) {
    const message = `Completion now resolves to ${completionDate}, after the client's own ${project.targetCompletionDate} — a real resource was double-booked elsewhere.`;
    Entity.setAttr(projectEntity.id, 'Schedule Risk', message, userId);
    const milestones = getMilestones(projectName);
    const finalMilestone = milestones.find((m) => m.milestoneType === 'Invoicing') ?? milestones.at(-1);
    if (finalMilestone) {
      const milestoneEntity = Entity.get(finalMilestone.name)!;
      Entity.setAttr(milestoneEntity.id, 'Schedule Risk', message, userId);
    }
  }
  return { achievable, completionDate, targetCompletionDate: project.targetCompletionDate };
}
