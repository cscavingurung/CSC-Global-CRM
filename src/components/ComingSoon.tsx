import { Construction } from 'lucide-react';

interface ComingSoonProps {
  pageName: string;
}

export default function ComingSoon({ pageName }: ComingSoonProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-16 h-16 rounded-2xl bg-navy/5 flex items-center justify-center mb-5">
        <Construction className="text-navy" size={32} />
      </div>
      <h2 className="text-xl font-semibold text-navy mb-2">{pageName}</h2>
      <p className="text-sm text-gray-500 max-w-sm">
        This page is coming soon. The full feature set is under development.
      </p>
    </div>
  );
}
