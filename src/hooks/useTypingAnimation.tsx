import { useState, useEffect } from 'react';

const suggestions = [
  "Build upper body strength",
  "Quick 15-minute cardio",
  "Core and abs workout",
  "Full body conditioning",
  "Leg day intensity",
  "Burn fat fast",
  "Beginner-friendly workout",
  "No equipment needed"
];

export const useTypingAnimation = (isActive: boolean) => {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const [charIndex, setCharIndex] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setDisplayText('');
      return;
    }

    const currentSuggestion = suggestions[currentIndex];

    if (isTyping) {
      if (charIndex < currentSuggestion.length) {
        const timeout = setTimeout(() => {
          setDisplayText(currentSuggestion.substring(0, charIndex + 1));
          setCharIndex(charIndex + 1);
        }, 80);
        return () => clearTimeout(timeout);
      } else {
        const timeout = setTimeout(() => {
          setIsTyping(false);
          setCharIndex(currentSuggestion.length);
        }, 2000);
        return () => clearTimeout(timeout);
      }
    } else {
      if (charIndex > 0) {
        const timeout = setTimeout(() => {
          setDisplayText(currentSuggestion.substring(0, charIndex - 1));
          setCharIndex(charIndex - 1);
        }, 50);
        return () => clearTimeout(timeout);
      } else {
        const timeout = setTimeout(() => {
          setIsTyping(true);
          setCurrentIndex((currentIndex + 1) % suggestions.length);
        }, 500);
        return () => clearTimeout(timeout);
      }
    }
  }, [isActive, charIndex, currentIndex, isTyping]);

  return displayText;
};
