import React from "react";

export const ComingSoonCard = ({ children, title = 'Coming Soon', description = "We're working hard to bring you something amazing. Stay tuned!" }: React.PropsWithChildren<{ id: string, title?: string, description?: string }>) => {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80 z-10 flex items-end justify-center pb-8">
        <div className="text-white text-center space-y-4">
          <h2 className="text-2xl font-bold">{title}</h2>
          <p className="text-lg">{description}</p>
        </div>
      </div>
      <div className="relative">
        {children}
      </div>
    </div>
  );
}