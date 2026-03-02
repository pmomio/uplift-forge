import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockConfigData } = vi.hoisted(() => {
  const mockConfigData: Record<string, unknown> = {};
  return { mockConfigData };
});

vi.mock('../../src/main/services/config.service.js', () => ({
  getConfig: vi.fn(() => ({
    project_key: 'PRIM',
    field_ids: { tpd_bu: 'cf_1', eng_hours: 'cf_2', work_stream: 'cf_3', story_points: 'cf_4' },
    mapping_rules: { tpd_bu: {}, work_stream: {} },
    eng_start_status: 'In Progress',
    eng_end_status: 'In Review',
    eng_excluded_statuses: ['Blocked'],
    ticket_filter: { mode: 'all' },
    projects: mockConfigData.projects ?? undefined,
    ...mockConfigData,
  })),
  updateConfig: vi.fn((patch: Record<string, unknown>) => {
    Object.assign(mockConfigData, patch);
  }),
}));

vi.mock('../../src/main/services/ticket.service.js', () => ({
  syncTickets: vi.fn().mockResolvedValue(10),
}));

vi.mock('../../src/main/services/metrics.service.js', () => ({
  getTeamMetrics: vi.fn().mockReturnValue({ summary: { total_tickets: 42 } }),
}));

import {
  listProjects,
  addProject,
  updateProject,
  removeProject,
  syncProject,
  getCrossProjectMetrics,
} from '../../src/main/services/project.service.js';
import { updateConfig } from '../../src/main/services/config.service.js';
import { syncTickets } from '../../src/main/services/ticket.service.js';
import type { ProjectConfig } from '../../src/shared/types.js';

describe('project.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock config data
    for (const key of Object.keys(mockConfigData)) delete mockConfigData[key];
  });

  describe('listProjects', () => {
    it('returns primary project from flat config', () => {
      const projects = listProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0].project_key).toBe('PRIM');
    });

    it('returns primary + additional projects', () => {
      mockConfigData.projects = [
        { project_key: 'EXTRA', field_ids: {}, mapping_rules: {}, eng_start_status: 'IP', eng_end_status: 'IR' },
      ];
      const projects = listProjects();
      expect(projects).toHaveLength(2);
      expect(projects[1].project_key).toBe('EXTRA');
    });
  });

  describe('addProject', () => {
    it('adds a project and returns updated list', () => {
      const newProject: ProjectConfig = {
        project_key: 'NEW',
        field_ids: { tpd_bu: '', eng_hours: '', work_stream: '', story_points: '' },
        mapping_rules: { tpd_bu: {}, work_stream: {} },
        eng_start_status: 'In Progress',
        eng_end_status: 'Done',
      };
      const result = addProject(newProject);
      expect(updateConfig).toHaveBeenCalled();
      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('updateProject', () => {
    it('updates primary project via flat config', () => {
      updateProject('PRIM', { eng_start_status: 'Dev' });
      expect(updateConfig).toHaveBeenCalledWith(
        expect.objectContaining({ eng_start_status: 'Dev' }),
      );
    });

    it('updates additional project in projects array', () => {
      mockConfigData.projects = [
        { project_key: 'EXTRA', field_ids: {}, mapping_rules: {}, eng_start_status: 'IP', eng_end_status: 'IR' },
      ];
      updateProject('EXTRA', { eng_start_status: 'Dev' });
      expect(updateConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          projects: expect.arrayContaining([
            expect.objectContaining({ project_key: 'EXTRA', eng_start_status: 'Dev' }),
          ]),
        }),
      );
    });

    it('does nothing for unknown project key', () => {
      updateProject('UNKNOWN', { eng_start_status: 'Dev' });
      // Still called but with empty projects array (no match found)
      expect(updateConfig).not.toHaveBeenCalled();
    });
  });

  describe('removeProject', () => {
    it('removes a project from the projects array', () => {
      mockConfigData.projects = [
        { project_key: 'EXTRA', field_ids: {}, mapping_rules: {}, eng_start_status: 'IP', eng_end_status: 'IR' },
      ];
      removeProject('EXTRA');
      expect(updateConfig).toHaveBeenCalledWith(
        expect.objectContaining({ projects: [] }),
      );
    });
  });

  describe('syncProject', () => {
    it('delegates to syncTickets', async () => {
      const result = await syncProject('PRIM');
      expect(syncTickets).toHaveBeenCalled();
      expect(result).toBe(10);
    });
  });

  describe('getCrossProjectMetrics', () => {
    it('returns team metrics', () => {
      const result = getCrossProjectMetrics('all');
      expect(result).toEqual({ summary: { total_tickets: 42 } });
    });
  });
});
