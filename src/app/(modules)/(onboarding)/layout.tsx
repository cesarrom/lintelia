export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-screen">
      <main className="flex-1 overflow-y-auto bg-gray-100">
        <div className="min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
