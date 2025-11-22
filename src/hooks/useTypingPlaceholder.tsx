import { useState, useEffect } from "react";

export const useTypingPlaceholder = (
  suggestions: string[],
  isActive: boolean
) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentText, setCurrentText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!isActive) {
      setCurrentText("");
      return;
    }

    const currentSuggestion = suggestions[currentIndex];
    
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        // Typing
        if (currentText.length < currentSuggestion.length) {
          setCurrentText(currentSuggestion.slice(0, currentText.length + 1));
        } else {
          // Pause before deleting
          setTimeout(() => setIsDeleting(true), 2000);
        }
      } else {
        // Deleting
        if (currentText.length > 0) {
          setCurrentText(currentText.slice(0, -1));
        } else {
          // Move to next suggestion
          setIsDeleting(false);
          setCurrentIndex((prev) => (prev + 1) % suggestions.length);
          setTimeout(() => {}, 500); // Pause before typing next
        }
      }
    }, isDeleting ? 50 : 80);

    return () => clearTimeout(timeout);
  }, [currentText, isDeleting, currentIndex, suggestions, isActive]);

  return isActive ? currentText : "";
};
