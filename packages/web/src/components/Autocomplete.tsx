'use client';
import React, { useState, InputHTMLAttributes } from 'react';
import { Combobox, ComboboxInput, ComboboxOption, ComboboxOptions } from '@headlessui/react';

interface AutocompleteProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'onSelect'> {
  suggestions?: string[];
  onSelect?: (value: string) => void;
}

const Autocomplete: React.FC<AutocompleteProps> = ({
  suggestions = [],
  placeholder = 'Type here...',
  onSelect,
  value: initialValue = '',
  ...inputProps
}) => {
  const [queryRef, setQuery] = useState<string>(initialValue as string);
  const query = queryRef || '';
  const filteredSuggestions =
    query === ''
      ? suggestions
      : [query, ...suggestions.filter((item) =>
          item.toLowerCase().includes(query.toLowerCase())
        )];

  return (
    <Combobox
      value={query}
      onChange={(value: string) => {
        setQuery(value);
        if (onSelect) {
          onSelect(value);
        }
      }}
    >
      <div className="relative">
        <ComboboxInput
          className="border border-gray-300 p-2 rounded w-full"
          placeholder={placeholder}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
          {...inputProps}
        />
        <ComboboxOptions className="absolute mt-1 max-h-60 w-full overflow-auto bg-white border border-gray-300 rounded-md shadow-lg">
          {filteredSuggestions.length > 0 ? (
            filteredSuggestions.map((item) => (
              <ComboboxOption
                key={item}
                value={item}
                className={({ active }: { active: boolean }) =>
                  `cursor-pointer select-none p-2 ${
                    active ? 'bg-blue-500 text-white' : 'text-gray-900'
                  }`
                }
              >
                {item}
              </ComboboxOption>
            ))
          ) : (
            <div className="p-2 text-gray-500">No suggestions found</div>
          )}
        </ComboboxOptions>
      </div>
    </Combobox>
  );
};

export default Autocomplete;