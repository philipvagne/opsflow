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

export const getProjectTasks = (token, projectId) =>
  api.get(`/projects/${projectId}/tasks`, {
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

export const addProjectMember = (token, projectId, membershipId) =>
  api.post(
    `/projects/${projectId}/members`,
    { membershipId },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

export const removeProjectMember = (token, projectId, membershipId) =>
  api.delete(`/projects/${projectId}/members/${membershipId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const deleteProject = (token, projectId) =>
  api.delete(`/projects/${projectId}`, {
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

export const removeOrganizationMember = (token, orgId, membershipId) =>
  api.delete(`/organizations/${orgId}/members/${membershipId}`, {
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

export const getTaskNotes = (token, taskId) =>
  api.get(`/tasks/${taskId}/notes`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const markTaskNotesSeen = (token, taskId) =>
  api.patch(
    `/tasks/${taskId}/notes/seen`,
    {},
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

export const getNotes = (token, filters = {}) =>
  api.get("/notes", {
    params: filters,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const createNote = (token, note) =>
  api.post("/notes", note, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const updateNote = (token, noteId, note) =>
  api.patch(`/notes/${noteId}`, note, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const getNoteLinks = (token, noteId) =>
  api.get(`/notes/${noteId}/links`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const addNoteLink = (token, noteId, linkedNoteId) =>
  api.post(
    `/notes/${noteId}/links`,
    { linkedNoteId },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

export const removeNoteLink = (token, noteId, linkedNoteId) =>
  api.delete(`/notes/${noteId}/links/${linkedNoteId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const deleteNote = (token, noteId) =>
  api.delete(`/notes/${noteId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export default api;
