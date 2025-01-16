interface IntroScreenProps {
  title: string;
  content: string;
  buttonText: string;
  onStart: () => void;
}

export function IntroScreen({ title, content, buttonText, onStart }: IntroScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <h1 className="text-2xl sm:text-3xl font-bold mb-4">{title}</h1>
      <p className="text-gray-600 mb-8">{content}</p>
      <button
        onClick={onStart}
        className="px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transition-colors absolute bottom-6 left-1/2 transform -translate-x-1/2"
      >
        {buttonText}
      </button>
    </div>
  );
}

