import { ReactNode, useEffect } from 'react';
import { atom, useAtom } from 'jotai';

// Create a theme atom to store the current theme
export const themeAtom = atom<'light' | 'dark'>(
  // Initialize from localStorage or default to system preference
  typeof window !== 'undefined'
    ? (localStorage.getItem('theme') as 'light' | 'dark') || 
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : 'light'
);

// Hook to use the theme
export function useTheme() {
  const [theme, setTheme] = useAtom(themeAtom);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return {
    theme,
    setTheme,
    toggleTheme,
  };
}

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { theme } = useTheme();

  // Update the class on the html element when the theme changes
  useEffect(() => {
    const root = window.document.documentElement;
    
    // Remove the previous theme class
    root.classList.remove('light', 'dark');
    
    // Add the current theme class
    root.classList.add(theme);
    
    // Save the theme preference to localStorage
    localStorage.setItem('theme', theme);
  }, [theme]);

  return <>{children}</>;
}
