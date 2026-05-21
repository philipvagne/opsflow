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
