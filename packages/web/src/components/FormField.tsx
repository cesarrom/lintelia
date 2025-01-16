import { FormField } from '@/lib/formParser';

interface FormFieldProps {
  field: FormField;
  value: string | number | string[];
  onChange: (key: string, value: string | number | string[]) => void;
  error?: string;
}

export function FormFieldComponent({ field, value, onChange, error }: FormFieldProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    onChange(field.key, e.target.value);
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Array.isArray(value) ? [...value] : [];
    if (e.target.checked) {
      newValue.push(e.target.value);
    } else {
      const index = newValue.indexOf(e.target.value);
      if (index > -1) {
        newValue.splice(index, 1);
      }
    }
    onChange(field.key, newValue);
  };

  const inputClasses = "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 text-sm sm:text-base";
  const labelClasses = "block text-sm sm:text-base font-medium text-gray-700 mb-1";
  const errorClasses = "mt-1 text-xs sm:text-sm text-red-600";

  switch (field.type) {
    case 'textfield':
    case 'number':
      return (
        <div className="w-full">
          <label htmlFor={field.id} className={labelClasses}>
            {field.label}
          </label>
          <input
            type={field.type === 'number' ? 'number' : 'text'}
            id={field.id}
            name={field.key}
            value={value as string | number}
            onChange={handleChange}
            min={field.validate?.min}
            max={field.validate?.max}
            required={field.validate?.required}
            className={inputClasses}
          />
          {error && <p className={errorClasses}>{error}</p>}
        </div>
      );
    case 'textarea':
      return (
        <div className="w-full">
          <label htmlFor={field.id} className={labelClasses}>
            {field.label}
          </label>
          <textarea
            id={field.id}
            name={field.key}
            value={value as string}
            onChange={handleChange}
            required={field.validate?.required}
            className={inputClasses}
            rows={3}
          />
          {error && <p className={errorClasses}>{error}</p>}
        </div>
      );
    case 'select':
      return (
        <div className="w-full">
          <label htmlFor={field.id} className={labelClasses}>
            {field.label}
          </label>
          <select
            id={field.id}
            name={field.key}
            value={value as string}
            onChange={handleChange}
            required={field.validate?.required}
            className={inputClasses}
          >
            <option value="">Select an option</option>
            {field.values?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {error && <p className={errorClasses}>{error}</p>}
        </div>
      );
    case 'checkbox':
      return (
        <div className="w-full">
          <fieldset>
            <legend className={labelClasses}>{field.label}</legend>
            <div className="mt-1 space-y-2">
              {field.values?.map((option) => (
                <div key={option.value} className="flex items-center">
                  <input
                    id={`${field.id}-${option.value}`}
                    name={field.key}
                    type="checkbox"
                    value={option.value}
                    checked={Array.isArray(value) && value.includes(option.value)}
                    onChange={handleCheckboxChange}
                    className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                  />
                  <label htmlFor={`${field.id}-${option.value}`} className="ml-3 block text-sm sm:text-base font-medium text-gray-700">
                    {option.label}
                  </label>
                </div>
              ))}
            </div>
          </fieldset>
          {error && <p className={errorClasses}>{error}</p>}
        </div>
      );
    default:
      return null;
  }
}

