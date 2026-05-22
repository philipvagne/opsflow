import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:3000",
});

export const getCurrentUser = (token) =>
  api.get("/users/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const getAuthProfile = (token) =>
  api.get("/auth/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const getOrganizationProjects = (token, orgId) =>
  api.get(`/organizations/${orgId}/projects`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const createProject = (token, orgId, project) =>
  api.post(`/organizations/${orgId}/projects`, project, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const getProject = (token, projectId) =>
  api.get(`/projects/${projectId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const updateProject = (token, projectId, project) =>
  api.patch(`/projects/${projectId}`, project, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const getMyOrganizations = (token) =>
  api.get("/organizations/my", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const createOrganization = (token, organization) =>
  api.post("/organizations", organization, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const getOrganizationMembers = (token, orgId) =>
  api.get(`/organizations/${orgId}/members`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const addOrganizationMember = (token, orgId, member) =>
  api.post(`/organizations/${orgId}/members`, member, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const createTask = (
  token,
  orgId,
  projectId,
  task
) =>
  api.post(
    `/organizations/${orgId}/projects/${projectId}/tasks`,
    task,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

export const searchUsers = (token, query) =>
  api.get("/users/search", {
    params: { q: query },
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const getTaskUpdates = (token, taskId) =>
  api.get(`/tasks/${taskId}/updates`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const createTaskUpdate = (token, taskId, message) =>
  api.post(
    `/tasks/${taskId}/updates`,
    { message },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

export const getArchivedTasks = (token) =>
  api.get("/tasks/archived", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const archiveTask = (token, taskId) =>
  api.patch(
    `/tasks/${taskId}/archive`,
    {},
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

export const restoreTask = (token, taskId) =>
  api.patch(
    `/tasks/${taskId}/restore`,
    {},
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

export default api;
