import { useEffect, useMemo, useRef, useState } from "react";

const normalize = (value) => value.toLowerCase().trim();

export default function CommandPalette({
  isOpen,
  tasks,
  onClose,
  onSelect,
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  const commands = useMemo(
    () => [
      {
        id: "go-tasks",
        label: "Go to Active Tasks",
        hint: "Workspace",
        type: "view",
        view: "tasks",
      },
      {
        id: "go-archive",
        label: "Go to Archived Tasks",
        hint: "Workspace",
        type: "view",
        view: "archive",
      },
      {
        id: "go-projects",
        label: "Go to Projects",
        hint: "Workspace",
        type: "view",
        view: "projects",
      },
      {
        id: "go-notes",
        label: "Go to Notes",
        hint: "Workspace",
        type: "view",
        view: "notes",
      },
      {
        id: "go-organizations",
        label: "Go to Teams",
        hint: "Workspace",
        type: "view",
        view: "organizations",
      },
      {
        id: "go-settings",
        label: "Go to Settings",
        hint: "Workspace",
        type: "view",
        view: "settings",
      },
      {
        id: "go-profile",
        label: "Go to Profile",
        hint: "Workspace",
        type: "view",
        view: "profile",
      },
      {
        id: "create-task",
        label: "Create new task",
        hint: "Action",
        type: "create-task",
      },
    ],
    []
  );

  const results = useMemo(() => {
    const term = normalize(query);
    const commandResults = commands
      .filter((command) => normalize(command.label).includes(term))
      .map((command) => ({
        ...command,
        resultType: "command",
      }));

    const taskResults = tasks
      .filter((task) => {
        if (!term) return true;

        const searchable = `${task.title || ""} ${
          task.description || ""
        }`.toLowerCase();

        return searchable.includes(term);
      })
      .slice(0, 8)
      .map((task) => ({
        id: `task-${task.id}`,
        label: task.title,
        hint: task.status,
        type: "open-task",
        task,
        resultType: "task",
      }));

    return [...commandResults, ...taskResults];
  }, [commands, query, tasks]);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setActiveIndex(0);
      return;
    }

    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!isOpen) {
    return null;
  }

  const selectResult = (result) => {
    if (!result) return;
    onSelect(result);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) =>
        results.length === 0 ? 0 : (current + 1) % results.length
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        results.length === 0
          ? 0
          : (current - 1 + results.length) % results.length
      );
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      selectResult(results[activeIndex]);
    }
  };

  return (
    <div className="command-palette-backdrop" onMouseDown={onClose}>
      <div
        className="command-palette"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="command-palette-search">
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search commands and tasks"
          />
          <span>Esc</span>
        </div>

        <div className="command-palette-results">
          {results.length === 0 ? (
            <div className="command-palette-empty">No matches</div>
          ) : (
            results.map((result, index) => (
              <button
                key={result.id}
                type="button"
                className={
                  index === activeIndex
                    ? "command-palette-item active"
                    : "command-palette-item"
                }
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectResult(result)}
              >
                <span>
                  <strong>{result.label}</strong>
                  <small>
                    {result.resultType === "task"
                      ? "Open task"
                      : result.hint}
                  </small>
                </span>
                <em>{result.hint}</em>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
