interface OutroScreenProps {
  title: string;
  content: string;
  buttonText: string;
  onFinish: () => void;
}

export function OutroScreen({ title, content, buttonText, onFinish }: OutroScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <h1 className="text-2xl sm:text-3xl font-bold mb-4">{title}</h1>
      <p className="text-gray-600 mb-8">{content}</p>
      <button
        onClick={onFinish}
        className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors absolute bottom-6 left-1/2 transform -translate-x-1/2 w-full"
      >
        {buttonText}
      </button>
    </div>
  );
}

