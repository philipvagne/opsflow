export default function TaskProductivityToolbar({
  filters,
  onFiltersChange,
  assigneeOptions,
  activeFilterCount,
  onClear,
}) {
  const updateFilter = (key, value) => {
    onFiltersChange((current) => ({
      ...current,
      [key]: value,
    }));
  };

  return (
    <div className="task-productivity-toolbar">
      <input
        className="toolbar-search"
        value={filters.search}
        onChange={(event) => updateFilter("search", event.target.value)}
        placeholder="Search tasks"
      />

      <select
        className="toolbar-select"
        value={filters.status}
        onChange={(event) => updateFilter("status", event.target.value)}
        title="Status"
      >
        <option value="ALL">All status</option>
        <option value="TODO">Todo</option>
        <option value="IN_PROGRESS">In progress</option>
        <option value="DONE">Done</option>
      </select>

      <select
        className="toolbar-select"
        value={filters.assignee}
        onChange={(event) => updateFilter("assignee", event.target.value)}
        title="Assignee"
      >
        <option value="ALL">All assignees</option>
        <option value="ME">Me</option>
        <option value="UNASSIGNED">Unassigned</option>
        {assigneeOptions.map((user) => (
          <option key={user.id} value={user.id}>
            {user.label}
          </option>
        ))}
      </select>

      <select
        className="toolbar-select"
        value={filters.due}
        onChange={(event) => updateFilter("due", event.target.value)}
        title="Due date"
      >
        <option value="ALL">All dates</option>
        <option value="OVERDUE">Overdue</option>
        <option value="TODAY">Due today</option>
        <option value="UPCOMING">Upcoming</option>
        <option value="NONE">No due date</option>
      </select>

      <select
        className="toolbar-select"
        value={filters.sort}
        onChange={(event) => updateFilter("sort", event.target.value)}
        title="Sort"
      >
        <option value="DUE_DATE">Due date</option>
        <option value="UPDATED">Recently updated</option>
        <option value="CREATED">Created date</option>
        <option value="TITLE">Title</option>
      </select>

      {activeFilterCount > 0 ? (
        <button
          type="button"
          className="toolbar-clear"
          onClick={onClear}
          title="Clear filters"
        >
          Clear {activeFilterCount}
        </button>
      ) : null}
    </div>
  );
}
