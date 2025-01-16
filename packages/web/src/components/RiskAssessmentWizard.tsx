'use client'

import { use, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { IntroScreen } from './IntroScreen';
import { OutroScreen } from './OutroScreen';
import React from 'react';

type RegisteredStep = { validateStep: () => Promise<string>, loading?: boolean, disabled?: boolean };

type RiskAssessmentWizardContextType = {
  currentStep: number;
  label: string;
  setLabel: (label: string) => unknown;
  setCurrentStep: (step: number) => unknown;
  error: string;
  setError: (error: string) => unknown;
  registerStep: (step: number, props: RegisteredStep) => unknown;
  handleNext: () => unknown;
  handlePrevious: () => unknown;
  loading: boolean;
  disabled: boolean;
};

const RiskAssessmentWizardContext = React.createContext<RiskAssessmentWizardContextType>({
  currentStep: 0,
  label: '',
  setLabel: (label: string) => { },
  setCurrentStep: (step: number) => { },
  error: '',
  setError: (error: string) => { },
  registerStep: (step: number, props: RegisteredStep) => { },
  handleNext: () => { },
  handlePrevious: () => { },
  loading: false,
  disabled: false,
});

const useRiskAssessmentWizard = () => React.useContext(RiskAssessmentWizardContext);

const RiskAssessmentWizardProvider = ({ children, ...props }: React.PropsWithChildren<RiskAssessmentWizardContextType>) => {
  return (
    <RiskAssessmentWizardContext.Provider value={props}>
      {children}
    </RiskAssessmentWizardContext.Provider>
  );
}

export function RiskAssessmentWizard({ children }: React.PropsWithChildren) {
  const [currentStep, setCurrentStep] = useState(-1); // Start at -1 for intro screen
  const [error, setError] = useState<string>('');
  const [steps, setSteps] = useState<Record<number, RegisteredStep>>({});
  const [label, setLabel] = useState<string>('');
  const fields = Object.values(steps);

  const cs = steps[currentStep];

  const registerStep = useCallback((step: number, props: RegisteredStep) => {
    setSteps((prev) => ({ ...prev, [step]: props }));
  }, []);

  const handleNext = useCallback(async () => {
    const error = await cs?.validateStep?.();
    if (error) {
      setError(error);
    } else {
      setError('');
      setCurrentStep((prev) => prev + 1);
    }
  }, [cs?.validateStep]);

  const handlePrevious = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (currentStep < fields.length) {
      await handleNext();
      return
    }

    const error = await cs?.validateStep?.();
    if (error) {
      setError(error);
    } else {
      setError('');
      setCurrentStep(fields.length); // Move to outro screen
    }
  }, [cs?.validateStep, currentStep, handleNext]);

  const handleFinish = useCallback(() => {
    // Here you would typically send the data to your backend
    alert('Thank you for your application. We will be in touch soon!');
    // Reset the form or redirect to another page
    setCurrentStep(-1);
    setError('');
  }, []);


  return (
    <RiskAssessmentWizardProvider {...{ currentStep: currentStep, setCurrentStep, error, setError, registerStep, handleNext, handlePrevious, label, setLabel, disabled: cs?.disabled, loading: cs?.loading }}>
      <div className="min-h-screen w-full flex flex-col bg-white md:bg-gray-100 md:items-center md:justify-center md:p-4">
        <div className="w-full h-full md:max-w-2xl flex flex-col md:bg-white md:shadow-lg md:rounded-lg md:overflow-hidden relative">
          <div className="bg-indigo-600 px-4 py-4 sm:px-6 sm:py-4">
            <h1 className="text-xl sm:text-2xl font-bold text-white">Banking Application</h1>
            <p className="mt-1 text-sm sm:text-base text-indigo-200">Please fill out the following form.</p>
          </div>
          <div className={`flex justify-center items-center h-full ${cs?.loading ? '' : 'hidden'}`}>
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
          <div className={`flex-grow flex flex-col p-4 sm:p-6 ${error ? 'border border-red-500' : ''} ${!cs?.loading ? '' : 'hidden'}`}>
            {currentStep === -1 ? (
              <IntroScreen
                title={'Welcome to Your Banking Application'}
                content={'Thank you for choosing our bank. This application will help us understand your needs and provide you with the best possible service. The process should take about 5-10 minutes to complete.'}
                buttonText={'Start Application'}
                onStart={handleNext}
              />
            ) : null}
            <div className={currentStep !== -1 && currentStep < fields.length ? `` : 'hidden'}>
              <form onSubmit={handleSubmit} className="flex-grow flex flex-col">
                <div className="flex-grow flex items-center justify-center">
                  {children}
                </div>
                <div className="mt-6 flex justify-between absolute bottom-6 left-1/2 transform -translate-x-1/2 w-full px-6">
                  {currentStep > 0 && (
                    <button
                      disabled={cs?.disabled || cs?.loading}
                      type="button"
                      onClick={handlePrevious}
                      className="px-3 py-2 sm:px-4 sm:py-2 text-sm sm:text-base bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50"
                    >
                      Previous
                    </button>
                  )}
                  {currentStep < fields.length - 1 ? (
                    <button
                      disabled={cs?.disabled || cs?.loading}
                      type="button"
                      onClick={handleNext}
                      className="px-3 py-2 sm:px-4 sm:py-2 text-sm sm:text-base bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50"
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      disabled={cs?.disabled || cs?.loading}
                      type="submit"
                      className="px-3 py-2 sm:px-4 sm:py-2 text-sm sm:text-base bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
                    >
                      Save and Next
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </RiskAssessmentWizardProvider>
  );
}

export const RiskAssessmentWizardStep = ({ children, step, validateStep, disabled, loading, onVisible }: React.PropsWithChildren<{ step: number, validateStep?: () => Promise<string | null>, disabled?: boolean; loading?: boolean, onVisible?: () => void }>) => {
  const { currentStep, registerStep } = useRiskAssessmentWizard();

  useEffect(() => {
    registerStep(step, { validateStep, disabled, loading });
    if (currentStep === step) {
      onVisible?.();
    }
  }, [validateStep, currentStep, step, disabled, loading]);

  if (currentStep !== step) {
    return null;
  }

  return <>{children}</>;
}

export const StyleExtractor = ({ activated, field, onStyles }: {
  activated: boolean, field: {
    id: string;
    key: string;
    type: 'textfield' | 'select' | 'textarea' | 'checkbox' | 'radio' | 'datetime';
    subtype?: 'date'
    label: string;
  }, onStyles: (styles: string) => void
}) => {
  const [styles, setStyles] = useState(``);
  const [forProp, setForProp] = useState<string>('');

  useEffect(() => {
    if (!activated) {
      onStyles('');
    } else {
      onStyles(styles);
    }
  }, [onStyles, styles, activated]);

  useLayoutEffect(() => {
    const run = () => {
      const labels = Array.from(document.querySelectorAll<HTMLLabelElement>('.fjs-form-field label'));
      const label = labels.find(label => label.getAttribute('for')?.includes(field.id));
      if (!label) return;
      const forAttr = label.getAttribute('for');
      if (forAttr !== forProp) {
        setForProp(forAttr);
      }
    };

    const observer = new MutationObserver(run);

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    run();

    return () => observer.disconnect();
  }, [field.id]);

  useEffect(() => {
    if (!forProp || !field.id) return;

    setStyles(`
      .fjs-powered-by {
        display: none;
      }
      
      .fjs-layout-row.cds--row {
        display: none;
      }

      .fjs-layout-row.cds--row:has(label[for="${forProp}"]) {
        display: flex !important;
      }
  
  `);
  }, [forProp, field.id]);

  return null;
}

export const RiskAssessmentWizardFormSteps = ({ children, formSchema, step, onSubmit, loading = false }: React.PropsWithChildren<{ formSchema: any, step: number, onSubmit: () => unknown, loading?: boolean }>) => {
  const { currentStep, handleNext, registerStep } = useRiskAssessmentWizard();
  const [forProp, setForProp] = useState<string>('');
  const fields = formSchema?.components || [];

  const field: {
    id: string;
    key: string;
    type: 'textfield' | 'select' | 'textarea' | 'checkbox' | 'radio' | 'datetime';
    subtype?: 'date'
    label: string;
  } = fields?.[currentStep] || {
    id: '',
    key: '',
    type: 'textfield',
    label: '',
  }

  const [styles, setStyles] = useState(``);

  const lastStep = step + fields.length - 1;

  console.log({
    forProp,
    currentStep,
    ...field,
  })

  const validateStep = useCallback(async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const errorElement = document.querySelector<HTMLDivElement>(`.fjs-layout-row.cds--row:has(label[for="${forProp}"]) .fjs-form-field-error`);

    if (errorElement) {
      return errorElement.textContent;
    }

    if (currentStep === lastStep) {
      await onSubmit();
    }

    return null;
  }, [currentStep, lastStep, onSubmit, forProp]);

  useEffect(() => {
    if (loading) {
      registerStep(step, { validateStep, loading });
      return;
    }

    let i = lastStep;

    while (i >= step) {
      registerStep(i, { validateStep });
      --i;
    }
  }, [fields.length, validateStep, loading]);

  useLayoutEffect(() => {
    const run = () => {
      const labels = Array.from(document.querySelectorAll<HTMLLabelElement>('.fjs-form-field label'));
      const label = labels.find(label => label.getAttribute('for')?.includes(field.id));
      if (!label) return;
      const forAttr = label.getAttribute('for');
      if (forAttr !== forProp) {
        setForProp(forAttr);
      }
    };

    const observer = new MutationObserver(run);

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    run();

    return () => observer.disconnect();
  }, [field.id]);

  useEffect(() => {
    if (!forProp || !field.id) return;

    setStyles(`
      .fjs-powered-by {
        display: none;
      }
      
      .fjs-layout-row.cds--row {
        display: none;
      }

      .fjs-layout-row.cds--row:has(label[for="${forProp}"]) {
        display: flex !important;
      }
  
  `);
  }, [forProp, field.id]);

  useLayoutEffect(() => {
    if (!forProp || !styles.includes(forProp)) return;

    // also, we will focus the element with the for attribute
    const target = document.querySelector<HTMLElement>(`#${forProp}, *[name="${forProp}"]`);

    if (!target) {
      return;
    }

    target.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;

      e.stopPropagation();
      e.preventDefault();

      const t = target as HTMLInputElement;

      const isFocused = document.activeElement === target;

      t?.focus?.();
      t?.blur?.();

      if (!isFocused) {
        t?.focus?.();
      }

      setTimeout(() => {
        handleNext();
      }, 50);
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [styles, forProp]);

  if (currentStep > step + fields.length) {
    return null;
  }

  return <>
    <style dangerouslySetInnerHTML={{ __html: styles }}></style>
    {children}
  </>;
}
