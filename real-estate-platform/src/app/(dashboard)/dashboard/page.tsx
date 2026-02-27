'use client';

import { useUser, UserButton } from '@clerk/nextjs';

export default function DashboardPage() {
  const { user } = useUser();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <div className="flex items-center gap-4">
        <UserButton />
        <h1 className="text-2xl font-bold">Dashboard — Phase 1 coming soon</h1>
      </div>
      {user && (
        <p className="text-gray-600">
          Signed in as: {user.primaryEmailAddress?.emailAddress}
        </p>
      )}
    </div>
  );
}
