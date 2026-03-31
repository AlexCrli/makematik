"use client";

import { useParams, useRouter } from "next/navigation";

export default function DevisRdvPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  return (
    <div>
      <button
        onClick={() => router.push(`/app/devis/${id}`)}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Retour au devis
      </button>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
        <svg className="w-16 h-16 text-gray-200 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Prise de RDV</h1>
        <p className="text-gray-500 text-sm mb-6">
          Cette fonctionnalité sera bientôt disponible.
        </p>
        <button
          onClick={() => router.push(`/app/devis/${id}`)}
          className="px-4 py-2.5 bg-[#6366f1] hover:bg-[#818cf8] text-white text-sm font-medium rounded-lg transition-colors"
        >
          Retour au devis
        </button>
      </div>
    </div>
  );
}
