import { useEffect, useState } from "react";

export default function usePersistentState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const storedValue = window.localStorage.getItem(key);

      if (storedValue === null) {
        return initialValue;
      }

      return JSON.parse(storedValue);
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Workspace memory is best-effort local browser state.
    }
  }, [key, value]);

  return [value, setValue];
}
